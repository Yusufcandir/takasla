# Güvenli Ürün Takas Platformu — Kapsamlı Proje Dokümantasyonu

> Yüksek değerli ürünler (lüks saatler, koleksiyon parçaları, nadir elektronikler) için risk tabanlı emanet (escrow) iş akışları, durum makinesi, blockchain hash sabitleme ve mikroservis mimarisi uygulayan bir C2C (tüketiciden tüketiciye) takas sistemi.

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Teknoloji Yığını](#2-teknoloji-yığını)
3. [Monorepo Yapısı](#3-monorepo-yapısı)
4. [Mikroservis Mimarisi](#4-mikroservis-mimarisi)
5. [Takas Durum Makinesi (Trade State Machine)](#5-takas-durum-makinesi)
6. [Risk Değerlendirme Sistemi](#6-risk-değerlendirme-sistemi)
7. [Olay Tabanlı İletişim (Event-Driven)](#7-olay-tabanlı-iletişim)
8. [Tutarlılık Kalıpları (Consistency Patterns)](#8-tutarlılık-kalıpları)
9. [Blockchain Katmanı](#9-blockchain-katmanı)
10. [Kargo Servisi](#10-kargo-servisi)
11. [Ödeme Servisi](#11-ödeme-servisi)
12. [Kimlik Doğrulama ve Yetkilendirme](#12-kimlik-doğrulama-ve-yetkilendirme)
13. [Dosya Depolama (Cloudflare R2)](#13-dosya-depolama)
14. [Frontend Uygulamaları](#14-frontend-uygulamaları)
15. [API Gateway](#15-api-gateway)
16. [Veritabanı Varlıkları (Entities)](#16-veritabanı-varlıkları)
17. [Docker Altyapısı](#17-docker-altyapısı)
18. [Güvenlik Önlemleri](#18-güvenlik-önlemleri)
19. [Dağıtım (Deployment)](#19-dağıtım)
20. [Komutlar ve Scriptler](#20-komutlar-ve-scriptler)

---

## 1. Genel Bakış

Bu platform, yüksek değerli ürünlerin güvenli bir şekilde takas edilmesini sağlayan tam kapsamlı bir C2C (tüketiciden tüketiciye) sistemdir. Hem çalışan bir platform hem de güven mekanizmalarını değerlendirmek için bir yazılım mühendisliği araştırma prototipidir.

### Temel Özellikler

- **Risk tabanlı emanet (escrow) iş akışları** — Her takasın risk seviyesi otomatik hesaplanır ve buna göre farklı doğrulama süreçleri uygulanır
- **21 durumlu takas durum makinesi** — Takasın her aşaması kesin kurallarla yönetilir
- **Blockchain hash sabitleme** — Sertifikalar Ethereum Sepolia'da Merkle ağacı olarak sabitlene bilir
- **Çift taraflı kanıt sistemi** — Her iki taraf da ürünlerinin fotoğraflarını ve kanıtlarını yüklemek zorundadır
- **Doğrulama merkezi desteği** — Yüksek riskli takaslar fiziksel doğrulama merkezinden geçer
- **Çoklu kargo sağlayıcı** — Yurtiçi (Geliver: Yurtiçi, Aras, MNG, PTT, Sürat, HepsiJet) ve uluslararası (EasyPost: FedEx, UPS, DHL)
- **Anlık mesajlaşma** — Kullanıcılar arası mesajlaşma sistemi
- **Sahtekarlık tespiti** — Döngüsel takas, aynı adres kullanımı, hız aşımı gibi kalıplar otomatik tespit edilir
- **Admin paneli** — Doğrulama kuyruğu, uyuşmazlık yönetimi, kullanıcı yönetimi, sahtekarlık bayrakları

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|--------|-----------|----------|
| **Backend** | NestJS (Node.js/TypeScript) | Her domain için ayrı mikroservis |
| **Veritabanı** | PostgreSQL 16 | Her servis kendi veritabanına sahip (11 ayrı DB) |
| **Mesaj Kuyruğu** | RabbitMQ 3.13 | Topic exchange ile olay tabanlı iletişim |
| **Önbellek/Kilitleme** | Redis 7 | Dağıtık kilitler (`SET NX EX`), idempotency |
| **Blockchain** | Ethereum Sepolia | Merkle kökü sabitleme (ethers.js v6) |
| **Nesne Depolama** | Cloudflare R2 | S3 uyumlu, `@aws-sdk/client-s3` ile erişim |
| **Kargo** | Geliver + EasyPost | Yurtiçi + uluslararası kargo entegrasyonu |
| **Ödeme** | Iyzico | Türk ödeme altyapısı, simülasyon modu destekli |
| **Frontend** | Next.js 14 (App Router) | 2 ayrı uygulama: kullanıcı + admin |
| **E-posta** | Nodemailer + Gmail SMTP | E-posta doğrulama için |
| **Ters Proxy** | Caddy 2 | Otomatik TLS, güvenlik başlıkları |
| **Altyapı** | Docker, Docker Compose | pnpm workspace monorepo |
| **Paket Yöneticisi** | pnpm | Workspace desteğiyle monorepo yönetimi |

---

## 3. Monorepo Yapısı

```
trading/
├── packages/
│   ├── shared-types/          # Paylaşılan enum, event, DTO tanımları
│   └── common/                # Ortak NestJS modülleri (DB, RabbitMQ, Outbox, Redis, Storage, Auth)
├── services/
│   ├── api-gateway/           # HTTP ters proxy, JWT doğrulama, rate limiting
│   ├── auth-service/          # Kayıt, giriş, JWT, e-posta doğrulama
│   ├── user-service/          # Profiller, güven puanı, adresler, avatar
│   ├── listing-service/       # İlanlar, kategoriler, görseller, soru-cevap, favoriler, boost
│   ├── offer-service/         # Teklif oluşturma/kabul/red, karşı teklifler
│   ├── trade-service/         # ANA SERVİS — durum makinesi, saga, risk, escrow, kanıt
│   ├── reputation-service/    # Puanlama, güven skoru, sahtekarlık tespiti
│   ├── dispute-service/       # Uyuşmazlıklar, kanıt, moderatör işlemleri
│   ├── certificate-service/   # Sertifikalar, Merkle ağacı, Sepolia sabitleme
│   ├── shipping-service/      # Çoklu kargo sağlayıcı (Geliver + EasyPost)
│   ├── payment-service/       # Iyzico ödemeleri, ilan boost, simülasyon modu
│   └── messaging-service/     # Kullanıcılar arası mesajlaşma
├── frontend/                  # Kullanıcı uygulaması (Next.js, port 4000)
├── admin-frontend/            # Admin paneli (Next.js, port 4001)
└── scripts/                   # Operasyonel scriptler
```

### Paylaşılan Paketler

#### `packages/shared-types`

Tüm servislerin ortak kullandığı tip tanımlarını içerir:

- **Enum'lar:** `TradeState` (21 durum), `RiskLevel`, `OfferStatus`, `ListingStatus`, `ItemCondition`, `DisputeStatus`, `DisputeReason`, `DisputeOutcome`, `ShipmentStatus`, `SagaState`, `CertificateStatus`, `AnchorStatus`, `Role`
- **Event arayüzleri:** `BaseEvent` temelinde 20+ olay tipi (trade, offer, dispute, payment, certificate, shipping, auth)
- **RabbitMQ sabitleri:** Exchange adı, routing key'ler, kuyruk isimleri
- **DTO'lar:** `RegisterDto`, `LoginDto`

#### `packages/common`

Her servisin ortak kullandığı NestJS modülleri:

| Modül | Açıklama |
|-------|----------|
| `DatabaseModule.forRoot()` | TypeORM + PostgreSQL bağlantısı, çevre değişkenleriyle konfigürasyon |
| `RabbitMQModule.forRoot()` | amqplib sarmalayıcı, topic exchange üzerinde publish/subscribe |
| `OutboxModule` + `OutboxService` | İşlemsel outbox kalıbı (2sn aralıklarla yoklama, 100'lük toplu yayın) |
| `RedisModule.forRoot()` | ioredis istemci sağlayıcı |
| `StorageModule.forRoot()` | Cloudflare R2 + yerel disk yedek (fallback) |
| `JwtAuthGuard` | JWT doğrulama, `@Public()` ve `@Roles()` desteği |
| `IdempotencyGuard` | `X-Idempotency-Key` başlığıyla çift istek engelleme |
| `RequestLoggingInterceptor` | JSON formatlı istek/yanıt günlüğü |
| `HealthModule` | `/health` sağlık kontrolü endpoint'i |
| `CurrentUser` dekoratör | JWT payload'ı request'ten çıkarır |

---

## 4. Mikroservis Mimarisi

Platform 12 bağımsız NestJS mikroservisinden oluşur. Her biri kendi PostgreSQL veritabanına sahiptir ve birbirleriyle yalnızca RabbitMQ olayları üzerinden iletişim kurar.

| Servis | Port | Veritabanı | Görev |
|--------|------|------------|-------|
| `api-gateway` | 3000 | yok | HTTP proxy, JWT doğrulama, rate limiting |
| `auth-service` | 3001 | `auth_db` | Kayıt, giriş, JWT + yenileme token, e-posta doğrulama |
| `user-service` | 3002 | `user_db` | Profiller, güven puanı, kayıtlı adresler, avatar yükleme |
| `listing-service` | 3003 | `listing_db` | İlanlar, kategoriler, görsel yükleme, soru-cevap, favoriler, boost |
| `offer-service` | 3004 | `offer_db` | Teklif oluştur/kabul et/reddet, karşı teklifler |
| `trade-service` | 3005 | `trade_db` | **ANA SERVİS** — durum makinesi, saga, risk, escrow, kanıt yükleme |
| `reputation-service` | 3006 | `reputation_db` | Derecelendirmeler, güven puanı hesaplama, sahtekarlık tespiti |
| `dispute-service` | 3007 | `dispute_db` | Uyuşmazlıklar, kanıt, moderatör işlemleri |
| `certificate-service` | 3008 | `certificate_db` | Sertifikalar, Merkle ağaçları, Sepolia sabitleme |
| `shipping-service` | 3009 | `shipping_db` | Çoklu kargo (Geliver yurtiçi + EasyPost uluslararası) |
| `payment-service` | 3010 | `payment_db` | Iyzico ödemeleri, ilan boost, simülasyon modu |
| `messaging-service` | 3011 | `messaging_db` | Kullanıcılar arası mesajlaşma |

### Servisler Arası Bağımlılık Grafiği

```
                              ┌─────────────┐
                              │  api-gateway │ (port 3000)
                              │  (HTTP Proxy)│
                              └──────┬───────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
   ┌─────▼─────┐  ┌────────▼────────┐  ┌────────▼────────┐
   │auth-service│  │ listing-service │  │  trade-service  │
   │  (3001)    │  │    (3003)       │  │    (3005)       │
   └─────┬──────┘  └────────┬────────┘  └────────┬────────┘
         │                  │                     │
         │ RabbitMQ         │ RabbitMQ            │ RabbitMQ
         ▼                  ▼                     ▼
   ┌────────────┐  ┌────────────────┐  ┌──────────────────┐
   │user-service│  │ offer-service  │  │reputation-service│
   │  (3002)    │  │   (3004)       │  │    (3006)        │
   └────────────┘  └────────────────┘  └──────────────────┘
                                              │
                           ┌──────────────────┼──────────────┐
                           ▼                  ▼              ▼
                   ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
                   │dispute-service│ │certificate-  │ │shipping-     │
                   │   (3007)     │  │service (3008)│ │service (3009)│
                   └──────────────┘  └──────────────┘ └──────────────┘
                                                              │
                   ┌──────────────┐  ┌──────────────┐        │
                   │payment-      │  │messaging-    │        │
                   │service (3010)│  │service (3011)│        │
                   └──────────────┘  └──────────────┘        │
```

---

## 5. Takas Durum Makinesi

Sistemin kalbi olan takas durum makinesi, `services/trade-service/src/state-machine/transitions.ts` dosyasında tanımlıdır. Her durum geçişi şu bileşenlerden oluşur:

- **from:** Mevcut durum
- **event:** Tetikleyici olay
- **to:** Hedef durum
- **guard:** Geçiş koşulu (opsiyonel fonksiyon)
- **sideEffects:** Yan etkiler dizisi (deklaratif, çağıran kod tarafından manuel uygulanır)

### Durum Akış Diyagramı

```
                    ┌──────────┐
                    │ INITIATED│
                    └────┬─────┘
                         │ offer_made
                    ┌────▼─────┐
                    │ OFFERED  │──── offer_rejected / timeout ────► CANCELLED
                    └────┬─────┘
                         │ offer_accepted
                    ┌────▼─────┐
                    │ ACCEPTED │──── cancel (1 saat içinde) ──────► CANCELLED
                    └────┬─────┘
                         │ items_locked
                    ┌────▼─────┐
                    │  LOCKED  │──── cancel ──────────────────────► CANCELLED
                    └────┬─────┘
                         │ proof_submitted (her iki taraf da)
               ┌─────────▼──────────┐
               │  PROOF_SUBMITTED   │──── cancel ────────────────► CANCELLED
               └─────────┬──────────┘
                         │ begin_verification
             ┌───────────▼────────────┐
             │  UNDER_VERIFICATION    │──── cancel ──────────────► CANCELLED
             └───────────┬────────────┘
                    ┌────┤
                    │    │ verification_rejected ──────────────────► LOCKED (yeniden gönder)
                    │    │
                    │    │ verified
               ┌────▼────▼┐
               │ VERIFIED  │──── cancel (iki taraf da ödemediyse) ► CANCELLED
               └─────┬─────┘
                     │
          ┌──────────┼──────────────────┐
          │          │                  │
    (kargo yok)   (kargolu)        (yerel teslim)
          │          │                  │
          │   ┌──────▼──────────┐  ┌───▼────────────────┐
          │   │SHIPPING_TO_CENTER│  │    DELIVERED        │
          │   └──────┬──────────┘  │  (onay veya süre    │
          │          │              │   dolumu ile)       │
          │   ┌──────▼──────┐      └───┬────────────────┘
          │   │  AT_CENTER  │          │
          │   └──────┬──────┘          │
          │          │                 │
          │   ┌──────▼──────────────┐  │
          │   │CENTER_VERIFICATION  │  │
          │   └──────┬──────────────┘  │
          │          │                 │
          │   ┌──────▼──────────┐     │
          │   │CENTER_VERIFIED  │     │
          │   └──────┬──────────┘     │
          │          │                 │
          │   ┌──────▼────────────────┐│
          │   │SHIPPING_TO_RECIPIENTS ││
          │   └──────┬────────────────┘│
          │          │                 │
          │   ┌──────▼──────┐         │
          │   │  DELIVERED  │◄────────┘
          │   └──────┬──────┘
          │          │ buyer_confirmed / dispute_window_expired
          │   ┌──────▼──────┐
          └──►│  COMPLETED  │
              └─────────────┘

    Herhangi bir durumdan ► DISPUTE_OPEN ► COMPLETED veya REVOKED
```

### Tüm Durumlar ve Açıklamaları

| Durum | Açıklama |
|-------|----------|
| `INITIATED` | Takas başlatıldı (teklif kabul edildi) |
| `OFFERED` | Teklif yapıldı, yanıt bekleniyor |
| `ACCEPTED` | Teklif kabul edildi, ürünler kilitlenecek |
| `LOCKED` | Her iki ürün de escrow'da kilitli |
| `PROOF_SUBMITTED` | Her iki taraf da kanıt (fotoğraf) yükledi |
| `UNDER_VERIFICATION` | Moderatör kanıtları inceliyor |
| `VERIFIED` | Kanıtlar doğrulandı, ödeme/kargo bekleniyor |
| `SHIPPING_TO_CENTER` | Ürünler doğrulama merkezine gönderiliyor |
| `AT_CENTER` | Ürünler merkezde, fiziksel inceleme bekleniyor |
| `CENTER_VERIFICATION` | Merkezde inceleme yapılıyor |
| `CENTER_VERIFIED` | Merkezde onaylandı, alıcılara kargo bekleniyor |
| `SHIPPING_TO_RECIPIENTS` | Ürünler alıcılara gönderiliyor |
| `DELIVERED` | Ürünler teslim edildi, itiraz penceresi açık |
| `COMPLETED` | Takas başarıyla tamamlandı |
| `DISPUTE_OPEN` | Uyuşmazlık açıldı |
| `CANCELLED` | Takas iptal edildi |
| `REVOKED` | Takas iptal edildi ve telafi uygulandı |

### Risk Seviyesine Göre Farklılıklar

| Özellik | DÜŞÜK (<0.3) | ORTA (0.3-0.6) | YÜKSEK (>=0.6) |
|---------|-------------|----------------|-----------------|
| Kanıt zorunluluğu | İsteğe bağlı | Zorunlu | Yapılandırılmış kontrol listesi |
| Doğrulama | Otomatik | Manuel moderatör | Uzman inceleme + merkez |
| İtiraz penceresi | 24 saat | 72 saat | 7 gün |
| Adım zaman aşımı | 24 saat | 48 saat | 72 saat |
| Blockchain sabitleme | Hayır | Opsiyonel | Zorunlu |

---

## 6. Risk Değerlendirme Sistemi

`services/trade-service/src/risk/risk-assessor.service.ts` dosyasında tanımlıdır.

### Formül

```
riskScore = (categoryWeight × 0.60) + (reputationPenalty × 0.25) + (disputeHistory × 0.15)
```

| Bileşen | Ağırlık | Kaynak | Açıklama |
|---------|---------|--------|----------|
| `categoryWeight` | %60 | Kategori tablosu | Her kategorinin `riskWeight` değeri (0.0–1.0). Lüks saat = yüksek, kitap = düşük |
| `reputationPenalty` | %25 | Güven puanı servisi | Düşük güven puanı = yüksek ceza. Yeni kullanıcılar varsayılan 50/100 puanla başlar |
| `disputeHistory` | %15 | İtiraz servisi | Kullanıcının geçmiş uyuşmazlık oranı |

### Eşik Değerleri

```
riskScore < 0.3  →  DÜŞÜK risk
riskScore < 0.6  →  ORTA risk
riskScore >= 0.6 →  YÜKSEK risk
```

---

## 7. Olay Tabanlı İletişim

Tüm servisler arası iletişim RabbitMQ topic exchange üzerinden gerçekleşir.

### Exchange ve Kuyruk Yapısı

- **Exchange:** `exchange.events` (tip: topic)
- **Routing key formatı:** `domain.action` (ör. `trade.locked`, `offer.accepted`)
- Her servis kendi kuyruğuna abone olur ve ilgili routing key'leri dinler

### Ana Olay Akışları

```
1. TEKLIF KABUL → TAKAS OLUŞTURMA
   offer.accepted → [trade.on-offer-events kuyruğu] → trade-service takas oluşturur

2. ÜRÜNLER KİLİTLENDİ → İLAN KİLİTLEME
   trade.locked → [listing.on-trade-events] → listing-service her iki ilanı kilitler

3. DOĞRULAMA TAMAM → SERTİFİKA OLUŞTURMA
   trade.verified → [cert.on-trade-events] → certificate-service sertifika düzenler

4. ÖDEME BAŞARILI → TAKAS İLERLEME
   payment.succeeded → [trade.on-payment-events] → trade-service ödemeyi kaydeder
   (Dikkat: tradeId yoksa boost ödemesidir, atlanır)

5. KARGO DURUMU → TAKAS İLERLEME
   shipping.label.created / shipping.in_transit / shipping.delivered
   → [trade.on-shipping-events] → trade-service kargo durumlarını ilerletir

6. TAKAS TAMAMLANDI → PUANLAMA AKTİF
   trade.completed → [reputation.on-trade-events] → reputation-service derecelendirmeyi etkinleştirir
   trade.completed → [listing.on-trade-events] → listing-service ilanları "traded" olarak işaretler

7. UYUŞMAZLIK ÇÖZÜLDÜ → TAKAS SONUÇLANMA
   dispute.resolved → [trade.on-dispute-events] → trade-service COMPLETED veya REVOKED'a geçer

8. BOOST ÖDEMESİ → İLAN ÖNE ÇIKARMA
   payment.boost.succeeded → [listing.on-payment-events] → listing-service featured/spotlight aktif eder

9. KAYIT → PROFİL OLUŞTURMA
   auth.user.registered → [user.on-auth-events] → user-service otomatik profil oluşturur

10. SAHTECİLİK TESPİTİ
    trade.fraud.duplicate_proof → fraud-detection bayrak oluşturur
```

---

## 8. Tutarlılık Kalıpları

### 8.1 Transactional Outbox (İşlemsel Giden Kutusu)

**Konum:** `packages/common/src/outbox/`

**Sorun:** Veritabanı işlemi başarılı olup mesaj gönderilemezse veri tutarsızlığı oluşur.

**Çözüm:** Olaylar aynı veritabanı işlemi (transaction) içinde `outbox` tablosuna yazılır. Ayrı bir yoklama süreci (2 saniye aralıklarla, 100'lük toplu işlemler) bu olayları RabbitMQ'ya yayınlar.

```
┌─────────────────────────────────────┐
│           DB Transaction            │
│  1. trade.state = LOCKED            │
│  2. INSERT INTO outbox (event)      │
│  COMMIT                             │
└───────────────────┬─────────────────┘
                    │
     ┌──────────────▼──────────────┐
     │    Outbox Polling Thread    │
     │  (her 2sn, 100 kayıt batch)│
     │  → RabbitMQ'ya yayınla      │
     │  → outbox.published = true  │
     └─────────────────────────────┘
```

### 8.2 Saga Orkestrasyon

**Konum:** `services/trade-service/src/saga/`

`TradeSagaOrchestrator` karmaşık çok adımlı süreçleri yönetir. Her adım sırayla çalıştırılır; bir adım başarısız olursa telafi işlemleri (compensating transactions) ters sırada çalışır.

```
Adım 1: Ürünleri kilitle    → Hata: Kilitleri geri al
Adım 2: Risk değerlendir     → Hata: Ürünleri kilitle aç
Adım 3: Ödeme talep et       → Hata: Ödemeyi iptal et, kilitleri aç
```

Saga durumu `saga_instances` tablosunda persist edilir.

### 8.3 Dağıtık Kilitleme

**Konum:** `services/trade-service/src/escrow/lock.service.ts`

İki ürünün aynı anda birden fazla takasta kilitlenmesini önler:

```
Redis: SET listing:lock:<listingId> <tradeId> NX EX <TTL>
DB:    INSERT INTO trade_locks (tradeId, listingId, lockedAt)
```

- `NX`: Anahtar yoksa oluştur (atomik kilitleme)
- `EX`: Otomatik süre dolumu (TTL)
- DB kaydı: Denetim izi (audit trail)

### 8.4 İdempotency (Tekrar Güvenliği)

**Konum:** `packages/common/src/idempotency/`

`X-Idempotency-Key` HTTP başlığı ile aynı isteğin birden fazla işlenmesi engellenir:

```
Redis: SET idempotency:<key> "processing" NX EX 3600
→ Anahtar zaten varsa: 409 Conflict
→ Yoksa: İsteği işle
```

### 8.5 İyimser Kilitleme (Optimistic Locking)

`TradeEntity` üzerinde `@VersionColumn()` — eş zamanlı güncellemelerde versiyon çakışması tespit edilir.

---

## 9. Blockchain Katmanı

### Merkle Ağacı ve Sabitleme

**Konum:** `services/certificate-service/src/`

1. Takaslar doğrulandığında sertifikalar oluşturulur
2. Günlük cron: Sabitleme bekleyen sertifikalardan Merkle ağacı inşa edilir
3. Merkle kökü (root hash) Ethereum Sepolia ağına gönderilir
4. `POST /certificates/anchor` ile manuel tetikleme yapılabilir

```
Sertifika 1 ─┐
              ├── Hash AB ─┐
Sertifika 2 ─┘             │
                            ├── Merkle Root → Sepolia TX
Sertifika 3 ─┐             │
              ├── Hash CD ─┘
Sertifika 4 ─┘
```

### Akıllı Kontrat: MerkleAnchor.sol

**Adres:** `0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3` (Sepolia)

```solidity
function anchor(bytes32 merkleRoot) external     // Merkle kökünü sabitler (tekrar sabitlenemez)
function getAnchor(bytes32) returns (timestamp, submitter)
function isAnchored(bytes32) returns (bool)
event Anchored(bytes32 indexed merkleRoot, uint256 timestamp, address submitter)
```

**Önemli:** Zincir üzerinde hiçbir kişisel veri saklanmaz — yalnızca hash değerleri.

Sepolia RPC URL veya private key yoksa simülasyon modunda çalışır.

---

## 10. Kargo Servisi

### Çoklu Kargo Sağlayıcı Mimarisi

```
CarrierProviderService
├── GeliverProvider (Türkiye → Türkiye)
│   ├── Yurtiçi Kargo
│   ├── Aras Kargo
│   ├── MNG Kargo
│   ├── PTT Kargo
│   ├── Sürat Kargo
│   └── HepsiJet
└── EasyPostProvider (Uluslararası)
    ├── FedEx
    ├── UPS
    └── DHL
```

**Yönlendirme kuralı:** Gönderici ve alıcı Türkiye'deyse → Geliver; aksi halde → EasyPost (simülasyon modu).

### İki Bacaklı Kargo (Two-Leg Shipping)

Doğrulama merkezli takaslarda kargo iki aşamada gerçekleşir:

```
Bacak 1: Gönderenler → Doğrulama Merkezi
  (SHIPPING_TO_CENTER → AT_CENTER)

Bacak 2: Doğrulama Merkezi → Alıcılar
  (CENTER_VERIFIED → SHIPPING_TO_RECIPIENTS → DELIVERED)
```

### Geliver SDK Entegrasyonu

Geliver SDK, ESM-only bir pakettir. NestJS (CommonJS) içinde çalıştırmak için özel bir yöntem kullanılır:

```typescript
// TypeScript'in import() → require() dönüşümünü atlatmak için:
const dynamicImport = new Function('specifier', 'return import(specifier)');
const geliver = await dynamicImport('@geliver/sdk');
```

`GELIVER_TEST_MODE=true` ile test gönderileri oluşturulur (durumları otomatik ilerler).

---

## 11. Ödeme Servisi

### Iyzico Entegrasyonu

- Türk ödeme altyapısı, kredi kartı/banka kartı desteği
- `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY` tanımlı değilse **simülasyon modunda** çalışır
- Platform ücreti: `PLATFORM_FEE_PERCENTAGE` (varsayılan %2.5)

### Ödeme Türleri

| Tür | Açıklama |
|-----|----------|
| `trade_fee` | Takas platform ücreti (her iki taraftan alınır) |
| `boost` | İlan öne çıkarma ödemesi |

### İlan Boost Fiyatlandırması

| Tür | Süre | Fiyat |
|-----|------|-------|
| `featured` | 7 gün | 149.99 TRY |
| `spotlight` | 30 gün | 449.99 TRY |

### İade (Refund) Mekanizması

- İptal edilen takaslarda `refundTradePayments()` çağrılır
- Pessimistic write lock ile çift iade (double refund) engellenir
- Simülasyon modundaki ödemeler (`sim_` önekli) gerçek iadesiz işaretlenir

---

## 12. Kimlik Doğrulama ve Yetkilendirme

### E-posta Doğrulama Akışı

```
1. POST /auth/register
   → Kullanıcı oluşturulur (isVerified: false)
   → Doğrulama token'ı oluşturulur (UUID, 24 saat geçerli)
   → Gmail SMTP üzerinden doğrulama e-postası gönderilir
   → { message, userId } döner (token yok!)

2. GET /auth/verify-email?token=xxx
   → Token doğrulanır, kullanıcı verified yapılır
   → { accessToken, refreshToken } döner (otomatik giriş)

3. POST /auth/login
   → isVerified=false ise → 401 reddedilir
   → Başarılıysa → { accessToken, refreshToken, userId }
```

### JWT Yapısı

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "user|moderator|admin"
}
```

- **Access Token:** Kısa ömürlü, her API isteğinde `Authorization: Bearer <token>` olarak gönderilir
- **Refresh Token:** Uzun ömürlü, hash'lenerek veritabanında saklanır, yeni token çifti almak için kullanılır

### Roller ve Yetkilendirme

| Rol | Yetkiler |
|-----|----------|
| `user` | İlan, teklif, takas, mesajlaşma, profil yönetimi |
| `moderator` | + Kanıt doğrulama, uyuşmazlık çözme, kullanıcı yönetimi |
| `admin` | + Tüm sistem erişimi, moderatör oluşturma |

---

## 13. Dosya Depolama

### Cloudflare R2 Entegrasyonu

**Konum:** `packages/common/src/storage/`

- `@aws-sdk/client-s3` ile S3 uyumlu erişim
- Endpoint: `https://{accountId}.r2.cloudflarestorage.com`
- R2 çevre değişkenleri yoksa → `uploads-fallback/` dizinine yerel kayıt

### Dosya Yükleme Yapan Servisler

| Servis | Dosya Türü | R2 Prefix |
|--------|------------|-----------|
| `listing-service` | İlan görselleri (max 10) | `listings/` |
| `trade-service` | Kanıt fotoğrafları (max 20) | `proofs/` |
| `user-service` | Avatar | `avatars/` |

### Yükleme Akışı

```
İstemci → multer (memoryStorage) → StorageService.upload() → R2 veya yerel disk
                                                              ↓
                                                    { key, url } döner
```

---

## 14. Frontend Uygulamaları

### Kullanıcı Uygulaması (`frontend/`, port 4000)

Koyu lacivert navigasyon teması.

**Sayfa Yapısı:**

| Yol | Açıklama |
|-----|----------|
| `/` | Ana sayfa / landing |
| `/dashboard` | Kullanıcı paneli |
| `/listings` | İlanlara göz at |
| `/listings/create` | Yeni ilan oluştur |
| `/listings/[id]` | İlan detayı |
| `/offers` | Tekliflerim |
| `/offers/create` | Teklif oluştur |
| `/trades` | Takaslarım |
| `/trades/[id]` | Takas detayı (tam durum makinesi arayüzü) |
| `/disputes` | Uyuşmazlıklarım |
| `/disputes/[id]` | Uyuşmazlık detayı |
| `/profile` | Profilim |
| `/profile/[userId]` | Herkese açık profil |
| `/certificates/[id]` | Sertifika detayı |
| `/favorites` | Favori ilanlar |
| `/messages` | Sohbet listesi |
| `/messages/[id]` | Sohbet |
| `/(auth)/login` | Giriş |
| `/(auth)/register` | Kayıt |
| `/(auth)/verify-email` | E-posta doğrulama |

**API İstemcisi (`src/lib/api.ts`):**
- Otomatik token yenileme (401 hatalarında tek seferlik yenileme denemesi)
- Eş zamanlı 401'lerde tek yenileme promise'i paylaşılır (race condition önlenir)
- Tipli API nesneleri: `authApi, listingsApi, offersApi, tradesApi, disputesApi, profileApi, ratingsApi, addressApi, paymentsApi, shippingApi, messagingApi, centersApi, certificatesApi, questionsApi, favoritesApi`

**Coğrafi API Rotaları (sunucu tarafı):**
- `/api/geo/countries` — Ülke listesi
- `/api/geo/states` — Eyalet/il listesi
- `/api/geo/cities` — Şehir listesi
- `/api/geo/turkey/districts` — Türkiye ilçeleri
- `/api/geo/turkey/neighbourhoods` — Türkiye mahalleleri

**Çoklu Dil Desteği:** Türkçe ve İngilizce (`src/locales/`)

### Admin Uygulaması (`admin-frontend/`, port 4001)

Amber (kehribar) renk teması. Kullanıcı uygulamasıyla ortak kod paylaşmaz.

| Yol | Açıklama |
|-----|----------|
| `/login` | Admin girişi |
| `/admin` | Genel bakış paneli |
| `/admin/verifications` | Bekleyen kanıt doğrulamaları |
| `/admin/verifications/[id]` | Doğrulama detayı: kanıt görüntüle, onayla/reddet |
| `/admin/center-verifications` | Merkez doğrulama kuyruğu |
| `/admin/center-verifications/[id]` | Merkez doğrulama detayı |
| `/admin/centers` | Doğrulama merkezleri yönetimi |
| `/admin/disputes` | Açık uyuşmazlıklar |
| `/admin/disputes/[id]` | Uyuşmazlık detayı: kanıt, çözüm |
| `/admin/trades` | Tüm takaslar (durum/risk filtreli) |
| `/admin/users` | Kullanıcı yönetimi |
| `/admin/fraud-flags` | Sahtekarlık bayrakları inceleme |

---

## 15. API Gateway

**Konum:** `services/api-gateway/`

Tüm HTTP trafiği tek giriş noktasından geçer. Gateway, istekleri ilgili servise yönlendirir.

### Yönlendirme Tablosu

```
/api/auth         → auth-service:3001
/api/users        → user-service:3002
/api/profiles     → user-service:3002
/api/addresses    → user-service:3002
/api/listings     → listing-service:3003
/api/categories   → listing-service:3003
/api/offers       → offer-service:3004
/api/trades       → trade-service:3005
/api/centers      → trade-service:3005
/api/reputation   → reputation-service:3006
/api/ratings      → reputation-service:3006
/api/fraud-flags  → reputation-service:3006
/api/disputes     → dispute-service:3007
/api/certificates → certificate-service:3008
/api/shipments    → shipping-service:3009
/api/payments     → payment-service:3010
/api/messaging    → messaging-service:3011
/api/conversations→ messaging-service:3011
```

### Güvenlik Katmanları

1. **ThrottlerGuard:** Dakikada 1000 istek limiti (global)
2. **AuthRateLimitMiddleware:** `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` için IP başına dakikada 100 istek
3. **AuthValidationMiddleware:** JWT varsa doğrular ve `req.user`'a ekler; tüm istekleri iletir

`main.ts`'de `bodyParser: false` ayarı ile ham gövde (raw body) servislere akıtılır (stream piping).

---

## 16. Veritabanı Varlıkları

### auth-service (`auth_db`)

**users**
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID (PK) | Otomatik üretilir |
| email | VARCHAR (unique) | Kullanıcı e-postası |
| passwordHash | VARCHAR | bcrypt hash |
| role | VARCHAR | `user` / `moderator` / `admin` |
| isVerified | BOOLEAN | E-posta doğrulama durumu |
| createdAt / updatedAt | TIMESTAMPTZ | Zaman damgaları |

**refresh_tokens**
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID (PK) | |
| userId | UUID (FK → users) | |
| tokenHash | VARCHAR | Yenileme token hash'i |
| expiresAt | TIMESTAMPTZ | Süre dolumu |
| revoked | BOOLEAN | İptal edildi mi |

**verification_tokens**
| Alan | Tip | Açıklama |
|------|-----|----------|
| id | UUID (PK) | |
| userId | UUID (FK → users) | |
| token | UUID (unique) | Doğrulama token'ı |
| expiresAt | TIMESTAMPTZ | 24 saat geçerli |
| used | BOOLEAN | Kullanıldı mı |

---

### trade-service (`trade_db`)

**trades** — Ana takas tablosu (50+ alan)
| Önemli Alanlar | Açıklama |
|----------------|----------|
| state | Mevcut durum (TradeState enum) |
| riskLevel / riskScore / riskFactors | Risk değerlendirmesi |
| partyAId / partyBId | Takas tarafları |
| listingAId / listingBId | Takaslanan ürünler |
| proofASubmitted / proofBSubmitted | Kanıt durumları |
| shippingMethod | `shipping` / `local_pickup` / `center` / null |
| partyAPaid / partyBPaid | Ödeme durumları |
| disputeWindowEnd | İtiraz penceresi bitiş zamanı |
| timeoutAt | Adım zaman aşımı |
| version | İyimser kilitleme versiyonu |

**trade_events** — Her durum değişikliğinin kaydı
**trade_locks** — Escrow kilitleri denetim izi
**proof_packages** — Yüklenen kanıt paketleri (hash'li)
**proof_image_hashes** — Perceptual hash ile kopya tespit
**saga_instances** — Saga orkestrasyon durumu
**verification_centers** — Fiziksel doğrulama merkezleri
**center_verifications** — Merkez doğrulama kayıtları

---

### listing-service (`listing_db`)

**listings** — İlan bilgileri
**listing_images** — İlan görselleri (sıralı)
**categories** — Kategoriler (riskWeight, baseFee dahil)
**listing_questions** — Soru-cevap
**listing_favorites** — Favori ilanlar

---

### offer-service (`offer_db`)

**offers** — Teklifler (durum: pending/accepted/rejected/countered/expired/cancelled)
**counter_offers** — Karşı teklifler

---

### reputation-service (`reputation_db`)

**ratings** — Derecelendirmeler (1-5 puan)
**completed_trades** — Tamamlanan takasların kaydı
**trust_score_snapshots** — Güven puanı tarihçesi
**fraud_flags** — Sahtekarlık bayrakları (circular_trading, same_address, rapid_rating, velocity_abuse)

---

### dispute-service (`dispute_db`)

**disputes** — Uyuşmazlıklar (SLA süresi, itiraz mekanizması dahil)
**evidence** — Kanıt dosyaları
**moderator_actions** — Moderatör işlem kaydı

---

### certificate-service (`certificate_db`)

**certificates** — Takas sertifikaları
**merkle_trees** — Merkle ağaçları (yapraklar, kök hash)
**blockchain_anchors** — Blockchain sabitleme kayıtları (TX hash, blok no)
**ownership_transfers** — Sahiplik transferleri

---

### shipping-service (`shipping_db`)

**shipments** — Gönderiler (leg: direct/to_center/to_recipient/return)
**shipment_events** — Kargo olay geçmişi

---

### payment-service (`payment_db`)

**payments** — Ödemeler (escrow durumu: none/held/released/refunded)

---

### messaging-service (`messaging_db`)

**conversations** — Sohbetler (iki katılımcı arası)
**messages** — Mesajlar (okundu durumu dahil)

---

## 17. Docker Altyapısı

### Altyapı Konteynerleri

| Konteyner | Görsel | Amaç |
|-----------|--------|------|
| 11× `postgres-*` | postgres:16-alpine | Her servis için ayrı PostgreSQL |
| `redis` | redis:7-alpine | Dağıtık kilitleme + idempotency |
| `rabbitmq` | rabbitmq:3.13-management-alpine | Olay mesajlaşması (management UI: 15672) |
| `caddy` | caddy:2-alpine | Ters proxy, otomatik TLS |
| `db-backup` | postgres:16-alpine + cron | 6 saatte bir yedekleme, 7 gün saklama |

### Uygulama Konteynerleri

12 mikroservis + 2 frontend = 14 uygulama konteyneri. Her birinin kendi `Dockerfile`'ı vardır (çok aşamalı build).

### Docker Volume'ları

```
caddy_data, caddy_config          — Caddy TLS sertifikaları
pgdata-{11 veritabanı}            — PostgreSQL kalıcı veriler
redis-data                        — Redis kalıcı veri
rabbitmq-data                     — RabbitMQ mesaj kuyrukları
trade-proof-uploads               — Kanıt dosyaları
user-avatars                      — Kullanıcı avatarları
listing-uploads                   — İlan görselleri
db-backups                        — Veritabanı yedekleri
```

### Caddy Yönlendirme

```
:80 (Kullanıcı uygulaması)
├── /api/geo/*  → frontend:4000     (Next.js sunucu tarafı API)
├── /api/*      → api-gateway:3000  (Backend API)
└── /*          → frontend:4000     (Next.js sayfaları)

:4001 (Admin paneli)
├── /api/*      → api-gateway:3000
└── /*          → admin-frontend:4001
```

Caddy tüm yanıtlara güvenlik başlıkları ekler: `X-Content-Type-Options`, `X-Frame-Options (DENY)`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`.

---

## 18. Güvenlik Önlemleri

| Kategori | Uygulama |
|----------|----------|
| **Kimlik doğrulama** | JWT (access + refresh token), e-posta doğrulama zorunlu |
| **Yetkilendirme** | Rol tabanlı erişim (user/moderator/admin), `@Roles()` dekoratörü |
| **Rate limiting** | Global (1000/dk), auth endpoint'leri (100/dk per IP) |
| **İdempotency** | `X-Idempotency-Key` ile çift istek engelleme |
| **CORS** | `ALLOWED_ORIGINS` veya `FRONTEND_URL` ile kısıtlı |
| **Veri bütünlüğü** | İyimser kilitleme, dağıtık kilitler, işlemsel outbox |
| **Dosya güvenliği** | SHA-256 + perceptual hash ile kopya/sahte kanıt tespit |
| **EXIF analizi** | Fotoğraf meta verisi inceleme (eski/yapay zeka üretimi tespit) |
| **Sahtekarlık tespiti** | Döngüsel takas, aynı adres, hız aşımı kalıpları |
| **Blockchain** | Sertifika hash'lerinin değiştirilemez sabitleması |
| **Güvenlik başlıkları** | CSP, X-Frame-Options, X-XSS-Protection (Caddy) |
| **Şifre güvenliği** | bcrypt hash, düz metin asla saklanmaz |
| **Token güvenliği** | Refresh token hash'lenerek saklanır, iptal edilebilir |

---

## 19. Dağıtım

### Hedef Ortam

- **Sunucu:** Oracle Cloud Always Free — VM.Standard.A1.Flex (4 ARM CPU, 24 GB RAM, 200 GB disk)
- **İşletim sistemi:** Ubuntu 22.04 (aarch64)
- **Domain:** DuckDNS ücretsiz alt alan adı + Let's Encrypt otomatik TLS
- **Maliyet:** Aylık $0

### Dağıtım Adımları (Özet)

1. DuckDNS'te 2 alt alan adı oluştur (`isim.duckdns.org` + `isim-admin.duckdns.org`)
2. Oracle Cloud'da ARM VM oluştur
3. Güvenlik listesinde 80 ve 443 portlarını aç
4. Kodu GitHub'a yükle
5. Sunucuya SSH ile bağlan, `scripts/setup-server.sh` çalıştır
6. Kodu klonla, `.env` yapılandır
7. `scripts/deploy.sh --domain İSİM` ile dağıt

Detaylar için `DEPLOYMENT.md` dosyasına bakınız.

---

## 20. Komutlar ve Scriptler

### Geliştirme Komutları

```bash
# Tüm bağımlılıkları kur
pnpm install

# Paylaşılan paketleri derle (servislerden önce gerekli)
pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build

# Tüm servisleri geliştirme modunda başlat
pnpm dev

# Tek bir servisi geliştirme modunda başlat
pnpm --filter @exchange/trade-service dev

# Sadece altyapıyı başlat (PostgreSQL x11, Redis, RabbitMQ)
docker-compose -f docker-compose.dev.yml up -d

# Tüm sistemi başlat (üretim konteynerleri)
docker-compose up -d

# Tek bir servisi yeniden derle
docker-compose up -d --build trade-service
```

### Scriptler

| Dosya | Açıklama |
|-------|----------|
| `scripts/deploy.sh` | Tam dağıtım: git pull, Caddyfile üretimi, Docker build, sağlık kontrolü |
| `scripts/setup-server.sh` | Sunucu ilk kurulumu: Docker, swap, güvenlik duvarı, DuckDNS |
| `scripts/backup-databases.sh` | Veritabanı yedeği (db-backup konteynerinde cron ile 6 saatte bir) |
| `scripts/deploy-merkle-anchor.ts` | MerkleAnchor.sol derle ve Sepolia'ya dağıt |
| `scripts/collect-metrics.ts` | Platform metrikleri topla (CSV + JSON) |
| `scripts/test-scenarios.js` | Entegrasyon test senaryoları |
| `scripts/oci-create-instance.py` | Oracle Cloud VM otomatik oluşturucu (kapasite yokken yeniden dener) |

### Faydalı Docker Komutları

```bash
# Tüm servislerin durumunu gör
docker compose ps

# Tüm logları takip et
docker compose logs -f

# Belirli bir servisin loglarını takip et
docker compose logs -f trade-service

# Tek bir servisi yeniden başlat
docker compose restart auth-service

# Disk kullanımını kontrol et
docker system df

# Eski Docker görsellerini temizle
docker image prune -f

# Manuel blockchain sabitleme
curl -X POST http://localhost:3000/api/certificates/anchor
```

---

## Çevre Değişkenleri Özeti

| Değişken | Servis | Açıklama |
|----------|--------|----------|
| `JWT_SECRET` | auth | JWT imzalama anahtarı |
| `SMTP_USER` / `SMTP_PASS` | auth | Gmail SMTP kimlik bilgileri |
| `FRONTEND_URL` | auth, payment | Doğrulama e-postası bağlantıları için |
| `NEXT_PUBLIC_API_URL` | frontend'ler | **Build zamanında sabitlenir** — IP değişince yeniden build gerekir |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | listing, trade, user | Cloudflare R2 depolama |
| `GELIVER_TOKEN` / `GELIVER_TEST_MODE` | shipping | Geliver kargo entegrasyonu |
| `EASYPOST_API_KEY` | shipping | EasyPost uluslararası kargo |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` | payment | Iyzico ödeme |
| `PLATFORM_FEE_PERCENTAGE` | payment | Platform ücreti oranı (varsayılan %2.5) |
| `SEPOLIA_RPC_URL` / `SEPOLIA_PRIVATE_KEY` / `MERKLE_ANCHOR_CONTRACT_ADDRESS` | certificate | Blockchain sabitleme |
| `*_DB_PASSWORD` | tüm servisler | Her servisin veritabanı şifresi |
| `RABBITMQ_PASSWORD` | tüm servisler | RabbitMQ bağlantı şifresi |

> Yapılandırılmamış servisler (R2, Geliver, EasyPost, Iyzico, Sepolia) otomatik olarak simülasyon/yedek modunda çalışır.

---

*Bu dokümantasyon, projenin mevcut durumunu kapsamlı olarak yansıtmaktadır. Son güncelleme: Mart 2026.*
