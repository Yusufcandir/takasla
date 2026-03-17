#!/usr/bin/env python3
"""
Oracle Cloud ARM Instance Auto-Creator
=======================================
Automatically retries creating a VM.Standard.A1.Flex instance until capacity
becomes available. Oracle's Always Free ARM instances are frequently out of
capacity — this script keeps trying until it succeeds.

Usage:
  1. Install OCI CLI and configure it:
       pip install oci
       oci setup config          # Follow prompts to create ~/.oci/config

  2. Run the script:
       python scripts/oci-create-instance.py

  3. To run in background (keeps going when you close the laptop):
       nohup python scripts/oci-create-instance.py > oci-create.log 2>&1 &
       # Check progress:
       tail -f oci-create.log

  4. On success, SSH keys are saved to ./oci-ssh-key and ./oci-ssh-key.pub
       ssh -i oci-ssh-key ubuntu@<PUBLIC_IP>

Configuration:
  Edit the CONFIG section below, or pass environment variables:
    OCI_COMPARTMENT_ID   — your compartment OCID (defaults to tenancy root)
    OCI_RETRY_INTERVAL   — seconds between retries (default: 60)
    OCI_INSTANCE_NAME    — instance display name (default: exchange-server)
"""

import os
import sys
import time
import random
import datetime

try:
    import oci
except ImportError:
    print("ERROR: OCI Python SDK not installed. Run: pip install oci")
    sys.exit(1)

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# ============================================================================
# CONFIG — Edit these values
# ============================================================================

INSTANCE_NAME = os.environ.get("OCI_INSTANCE_NAME", "exchange-server")
SHAPE = "VM.Standard.A1.Flex"
OCPUS = 1.0
MEMORY_GB = 2.0
BOOT_VOLUME_GB = 200

# Retry settings
RETRY_INTERVAL = int(os.environ.get("OCI_RETRY_INTERVAL", "90"))  # seconds
MAX_RETRIES = 0  # 0 = unlimited (keep trying forever)

# SSH key output paths (relative to script's working directory)
SSH_PRIVATE_KEY_PATH = "oci-ssh-key"
SSH_PUBLIC_KEY_PATH = "oci-ssh-key.pub"

# ============================================================================
# MAIN SCRIPT
# ============================================================================

def log(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def generate_ssh_keys() -> tuple[str, str]:
    """Generate an RSA 4096-bit SSH key pair. Returns (private_pem, public_openssh)."""
    if os.path.exists(SSH_PRIVATE_KEY_PATH) and os.path.exists(SSH_PUBLIC_KEY_PATH):
        log(f"SSH keys already exist at {SSH_PRIVATE_KEY_PATH}, reusing them.")
        with open(SSH_PUBLIC_KEY_PATH, "r") as f:
            pub = f.read().strip()
        with open(SSH_PRIVATE_KEY_PATH, "r") as f:
            priv = f.read()
        return priv, pub

    log("Generating new RSA 4096-bit SSH key pair...")
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_openssh = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH,
    ).decode("utf-8")

    # Save keys to disk
    with open(SSH_PRIVATE_KEY_PATH, "w") as f:
        f.write(private_pem)
    os.chmod(SSH_PRIVATE_KEY_PATH, 0o600)

    with open(SSH_PUBLIC_KEY_PATH, "w") as f:
        f.write(public_openssh + "\n")

    log(f"SSH private key saved to: {os.path.abspath(SSH_PRIVATE_KEY_PATH)}")
    log(f"SSH public key saved to:  {os.path.abspath(SSH_PUBLIC_KEY_PATH)}")
    return private_pem, public_openssh


def find_ubuntu_image(compute_client: oci.core.ComputeClient, compartment_id: str) -> str:
    """Find the latest Ubuntu 22.04 aarch64 image compatible with VM.Standard.A1.Flex."""
    log("Looking for Ubuntu 22.04 aarch64 image...")
    response = compute_client.list_images(
        compartment_id=compartment_id,
        operating_system="Canonical Ubuntu",
        operating_system_version="22.04",
        shape=SHAPE,
        lifecycle_state="AVAILABLE",
    )
    images = response.data
    if not images:
        log("ERROR: No Ubuntu 22.04 aarch64 images found for VM.Standard.A1.Flex!")
        sys.exit(1)

    # Sort by creation time, newest first
    images.sort(key=lambda img: img.time_created, reverse=True)
    chosen = images[0]
    log(f"Found image: {chosen.display_name} ({chosen.id})")
    return chosen.id


def find_subnet(network_client: oci.core.VirtualNetworkClient, compartment_id: str) -> str:
    """Find the first available subnet. If none exist, create a VCN + subnet."""
    log("Looking for an available subnet...")

    # List VCNs
    vcns = network_client.list_vcns(compartment_id=compartment_id, lifecycle_state="AVAILABLE").data
    if not vcns:
        log("No VCN found. Creating a new VCN...")
        vcn_response = network_client.create_vcn(
            oci.core.models.CreateVcnDetails(
                compartment_id=compartment_id,
                display_name="exchange-vcn",
                cidr_blocks=["10.0.0.0/16"],
            )
        )
        vcn = vcn_response.data
        log(f"Created VCN: {vcn.display_name} ({vcn.id})")

        # Create internet gateway
        ig_response = network_client.create_internet_gateway(
            oci.core.models.CreateInternetGatewayDetails(
                compartment_id=compartment_id,
                vcn_id=vcn.id,
                display_name="exchange-igw",
                is_enabled=True,
            )
        )
        ig = ig_response.data
        log(f"Created Internet Gateway: {ig.id}")

        # Update default route table to route 0.0.0.0/0 through IGW
        rt_id = vcn.default_route_table_id
        network_client.update_route_table(
            rt_id,
            oci.core.models.UpdateRouteTableDetails(
                route_rules=[
                    oci.core.models.RouteRule(
                        destination="0.0.0.0/0",
                        destination_type="CIDR_BLOCK",
                        network_entity_id=ig.id,
                    )
                ]
            ),
        )
        log("Updated default route table with internet gateway route.")

        # Create a public subnet
        subnet_response = network_client.create_subnet(
            oci.core.models.CreateSubnetDetails(
                compartment_id=compartment_id,
                vcn_id=vcn.id,
                display_name="exchange-subnet",
                cidr_block="10.0.0.0/24",
                prohibit_public_ip_on_vnic=False,
            )
        )
        subnet = subnet_response.data
        log(f"Created subnet: {subnet.display_name} ({subnet.id})")
        return subnet.id

    # Use existing VCN — find a public subnet
    for vcn in vcns:
        subnets = network_client.list_subnets(
            compartment_id=compartment_id,
            vcn_id=vcn.id,
            lifecycle_state="AVAILABLE",
        ).data
        for subnet in subnets:
            if not subnet.prohibit_public_ip_on_vnic:
                log(f"Using subnet: {subnet.display_name} ({subnet.id})")
                return subnet.id

    # No public subnet found in any VCN
    log("ERROR: No public subnet found. Please create one in the Oracle Cloud Console.")
    sys.exit(1)


def get_availability_domains(identity_client, compartment_id: str) -> list:
    """List all availability domains."""
    response = identity_client.list_availability_domains(compartment_id=compartment_id)
    ads = response.data
    log(f"Found {len(ads)} availability domain(s): {', '.join(ad.name for ad in ads)}")
    return ads


def try_launch(
    compute_client: oci.core.ComputeClient,
    ad_name: str,
    compartment_id: str,
    image_id: str,
    subnet_id: str,
    ssh_public_key: str,
) -> oci.core.models.Instance | None:
    """Attempt to launch an instance in the given AD. Returns Instance on success, None on capacity error."""
    launch_details = oci.core.models.LaunchInstanceDetails(
        availability_domain=ad_name,
        compartment_id=compartment_id,
        display_name=INSTANCE_NAME,
        shape=SHAPE,
        shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
            ocpus=OCPUS,
            memory_in_gbs=MEMORY_GB,
        ),
        source_details=oci.core.models.InstanceSourceViaImageDetails(
            source_type="image",
            image_id=image_id,
            boot_volume_size_in_gbs=BOOT_VOLUME_GB,
        ),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=subnet_id,
            assign_public_ip=True,
        ),
        metadata={"ssh_authorized_keys": ssh_public_key},
    )

    try:
        response = compute_client.launch_instance(launch_details)
        return response.data
    except oci.exceptions.ServiceError as e:
        if e.status == 500 and "Out of host capacity" in (e.message or ""):
            return None  # Expected — retry
        if e.status == 500 and "capacity" in (e.message or "").lower():
            return None  # Catch other capacity variants
        if e.status == 429:
            log(f"  Rate limited (429). Will retry after delay.")
            return None
        # Unexpected error — re-raise
        raise


def wait_for_running(compute_client: oci.core.ComputeClient, instance_id: str) -> oci.core.models.Instance:
    """Wait for the instance to reach RUNNING state."""
    log("Waiting for instance to reach RUNNING state...")
    response = oci.wait_until(
        compute_client,
        compute_client.get_instance(instance_id),
        "lifecycle_state",
        "RUNNING",
        max_wait_seconds=600,
        max_interval_seconds=15,
    )
    return response.data


def get_public_ip(compute_client, network_client, compartment_id: str, instance_id: str) -> str | None:
    """Get the public IP of an instance."""
    vnic_attachments = compute_client.list_vnic_attachments(
        compartment_id=compartment_id,
        instance_id=instance_id,
    ).data

    for va in vnic_attachments:
        if va.lifecycle_state != "ATTACHED":
            continue
        vnic = network_client.get_vnic(va.vnic_id).data
        if vnic.public_ip:
            return vnic.public_ip
    return None


def main():
    log("=" * 60)
    log("Oracle Cloud ARM Instance Auto-Creator")
    log("=" * 60)

    # Load OCI config
    try:
        config = oci.config.from_file()
        oci.config.validate_config(config)
    except Exception as e:
        log(f"ERROR: Failed to load OCI config: {e}")
        log("Run 'oci setup config' first to create ~/.oci/config")
        sys.exit(1)

    compartment_id = os.environ.get("OCI_COMPARTMENT_ID", config["tenancy"])
    log(f"Tenancy:     {config['tenancy']}")
    log(f"Region:      {config['region']}")
    log(f"Compartment: {compartment_id}")
    log(f"Shape:       {SHAPE} ({OCPUS} OCPU, {MEMORY_GB} GB RAM)")
    log(f"Boot volume: {BOOT_VOLUME_GB} GB")
    log(f"Retry every: {RETRY_INTERVAL}s")
    log("")

    # Generate SSH keys
    _, ssh_public_key = generate_ssh_keys()
    log("")

    # Initialize clients
    compute_client = oci.core.ComputeClient(config)
    network_client = oci.core.VirtualNetworkClient(config)
    identity_client = oci.identity.IdentityClient(config)

    # Gather required IDs
    image_id = find_ubuntu_image(compute_client, compartment_id)
    subnet_id = find_subnet(network_client, compartment_id)
    availability_domains = get_availability_domains(identity_client, compartment_id)

    if not availability_domains:
        log("ERROR: No availability domains found!")
        sys.exit(1)

    log("")
    log("=" * 60)
    log("Starting creation loop. Will retry until an instance is created.")
    log(f"Trying {len(availability_domains)} availability domain(s) each round.")
    log("Press Ctrl+C to stop.")
    log("=" * 60)
    log("")

    attempt = 0
    while True:
        attempt += 1
        if MAX_RETRIES > 0 and attempt > MAX_RETRIES:
            log(f"Reached max retries ({MAX_RETRIES}). Giving up.")
            sys.exit(1)

        # Shuffle ADs each round to spread load
        ads = list(availability_domains)
        random.shuffle(ads)

        for ad in ads:
            log(f"Attempt #{attempt} — AD: {ad.name}")
            try:
                instance = try_launch(
                    compute_client, ad.name, compartment_id,
                    image_id, subnet_id, ssh_public_key,
                )
            except oci.exceptions.ServiceError as e:
                log(f"  ERROR: {e.status} {e.code} — {e.message}")
                if e.status == 400 and "LimitExceeded" in (e.code or ""):
                    log("  You've hit the Always Free tier limit.")
                    log("  Check if you already have an A1 instance running.")
                    sys.exit(1)
                continue
            except Exception as e:
                log(f"  Unexpected error: {e}")
                continue

            if instance is None:
                log(f"  Out of capacity in {ad.name}. Will retry...")
                continue

            # SUCCESS!
            log("")
            log("=" * 60)
            log("SUCCESS! Instance is being provisioned!")
            log("=" * 60)
            log(f"  Instance ID:   {instance.id}")
            log(f"  Display Name:  {instance.display_name}")
            log(f"  AD:            {instance.availability_domain}")
            log(f"  State:         {instance.lifecycle_state}")

            # Wait for RUNNING
            instance = wait_for_running(compute_client, instance.id)
            log(f"  State:         {instance.lifecycle_state}")

            # Get public IP
            public_ip = get_public_ip(compute_client, network_client, compartment_id, instance.id)
            if public_ip:
                log(f"  Public IP:     {public_ip}")
            else:
                log("  Public IP:     (not yet assigned, check console)")

            log("")
            log("=" * 60)
            log("NEXT STEPS:")
            log("=" * 60)
            log(f"  1. SSH into your server:")
            log(f"     ssh -i {SSH_PRIVATE_KEY_PATH} ubuntu@{public_ip or '<PUBLIC_IP>'}")
            log(f"")
            log(f"  2. Update DuckDNS with the public IP: {public_ip}")
            log(f"")
            log(f"  3. Open ports 80 and 443 in Oracle Security List")
            log(f"     (see DEPLOYMENT.md Step 4)")
            log(f"")
            log(f"  4. Run the server setup script:")
            log(f"     scp -i {SSH_PRIVATE_KEY_PATH} scripts/setup-server.sh ubuntu@{public_ip}:/tmp/")
            log(f"     ssh -i {SSH_PRIVATE_KEY_PATH} ubuntu@{public_ip}")
            log(f"     sudo bash /tmp/setup-server.sh --duckdns-token YOUR_TOKEN --domain YOURNAME")
            log("=" * 60)
            return

        # All ADs exhausted this round — wait before next round
        jitter = random.randint(0, 15)
        wait = RETRY_INTERVAL + jitter
        log(f"All ADs out of capacity. Sleeping {wait}s before next round...")
        log("")
        time.sleep(wait)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\nStopped by user (Ctrl+C).")
        sys.exit(0)
