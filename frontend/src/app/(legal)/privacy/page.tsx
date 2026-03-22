'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

export default function PrivacyPage() {
  const { locale } = useTranslation();

  if (locale === 'tr') {
    return <PrivacyContentTR />;
  }
  return <PrivacyContentEN />;
}

function PrivacyContentTR() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Gizlilik Politikasi</h1>
      <p className="text-sm text-slate-500 mb-8">Son guncelleme: 22 Mart 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Genel Bakis</h2>
          <p className="text-slate-600 leading-relaxed">
            Takasla (&quot;biz&quot;, &quot;Platform&quot;) olarak gizliliginize onem veriyoruz. Bu Gizlilik Politikasi, Platformumuzu kullandiginizda kisisel verilerinizi nasil topladigimizi, kullandigimizi, sakladigimizi ve korudugumuz aciklamaktadir.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            Bu politika, 6698 sayili Kisisel Verilerin Korunmasi Kanunu (KVKK) ve ilgili mevzuata uygun olarak hazirlanmistir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Topladigimiz Bilgiler</h2>
          <h3 className="text-lg font-medium text-slate-700 mt-4 mb-2">2.1 Dogrudan Sagladiginiz Bilgiler</h3>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Kayit sirasinda: e-posta adresi, sifre, gorünen ad</li>
            <li>Profil bilgileri: biyografi, konum, profil fotograflari</li>
            <li>Ilan bilgileri: urun basligi, aciklamasi, fotograflari, fiyati, kategorisi</li>
            <li>Adres bilgileri: kargo icin ad, adres, telefon numarasi</li>
            <li>Mesajlar: diger kullanicilarla yapilan yazismalar</li>
            <li>Anlasmazlik kanitleri: fotograflar, videolar, belgeler, metin aciklamalari</li>
          </ul>

          <h3 className="text-lg font-medium text-slate-700 mt-4 mb-2">2.2 Otomatik Olarak Toplanan Bilgiler</h3>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>IP adresi ve tarayici bilgileri</li>
            <li>Erisim kayitlari ve kullanim istatistikleri</li>
            <li>Gorsellerden EXIF meta verileri (islem sonrasi temizlenir)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Cerezler ve Yerel Depolama</h2>
          <p className="text-slate-600 leading-relaxed">
            Platformumuz <strong>cerez (cookie) kullanmamaktadir</strong>. Kimlik dogrulama tokenlari tarayicinizin yerel deposunda (localStorage) saklanmaktadir. Bu veriler sadece cihazinizda tutulur ve sunuculara otomatik olarak gonderilmez.
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1 mt-3">
            <li><strong>accessToken:</strong> Oturum dogrulama (JWT)</li>
            <li><strong>refreshToken:</strong> Oturum yenileme</li>
            <li><strong>userId:</strong> Kullanici kimlik numarasi</li>
            <li><strong>locale:</strong> Dil tercihiniz (TR/EN)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Bilgilerin Kullanimi</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Topladigimiz bilgileri asagidaki amaclarla kullanmaktayiz:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Hesabinizi olusturmak ve yonetmek</li>
            <li>Takas islemlerini kolaylastirmak</li>
            <li>Kargo hizmetlerini saglamak</li>
            <li>Odeme islemlerini gerceklestirmek</li>
            <li>Platform guvenligini saglamak ve dolandiricilik tespiti yapmak</li>
            <li>Anlasmazliklari cozumlemek</li>
            <li>Guven puanlarini hesaplamak</li>
            <li>Blockchain sertifikalari olusturmak</li>
            <li>Size bildirimler ve guncellemeler gondermek</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Bilgilerin Paylasimi</h2>
          <p className="text-slate-600 leading-relaxed mb-3">
            Kisisel verilerinizi asagidaki durumlar disinda ucuncu taraflarla paylasmayiz:
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Hizmet saglayicilar:</strong> E-posta gonderimi (Brevo), dosya depolama (Cloudflare R2), odeme isleme (Stripe), icerik denetimi (SightEngine), kargo (Geliver, EasyPost)</li>
            <li><strong>Diger kullanicilar:</strong> Takas islemleri sirasinda kargo adresi karsı tarafla paylasilir</li>
            <li><strong>Yasal zorunluluklar:</strong> Mahkeme karari veya yasal düzenleme gerektirmesi halinde</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Kisisel verilerinizi hicbir zaman reklam veya pazarlama amacli ucuncu taraflara satmayiz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Veri Guvenligi</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Sifreler bcrypt algoritmasiyla hash&apos;lenerek saklanir</li>
            <li>Tum veri aktarimi SSL/TLS ile sifrelenir</li>
            <li>Yuklenen gorsellerden GPS koordinatlari ve kamera bilgileri otomatik temizlenir</li>
            <li>Her hizmet ayri veritabaninda izole edilmistir</li>
            <li>JWT tabanli erisim kontrolu ve rol bazli yetkilendirme</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Haklariniz</h2>
          <p className="text-slate-600 leading-relaxed mb-3">KVKK kapsaminda asagidaki haklara sahipsiniz:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Erisim hakki:</strong> Profil sayfanizdan &quot;Verilerimi Indir&quot; ile tum verilerinizi indirebilirsiniz</li>
            <li><strong>Duzeltme hakki:</strong> Profil sayfanizdan bilgilerinizi guncelleyebilirsiniz</li>
            <li><strong>Silme hakki:</strong> Profil sayfanizdan hesabinizi ve tum verilerinizi kalici olarak silebilirsiniz</li>
            <li><strong>Itiraz hakki:</strong> Otomatik islem sonuclarina itiraz edebilirsiniz</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Degisiklikler</h2>
          <p className="text-slate-600 leading-relaxed">
            Bu Gizlilik Politikasi&apos;ni zaman zaman guncelleyebiliriz. Onemli degisikliklerde kayitli e-posta adresinize bildirim gonderilecektir. Platformu kullanmaya devam etmeniz, guncellenmis politikayi kabul ettiginiz anlamina gelir.
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Sorulariniz icin{' '}
            <a href="mailto:kvkk@takasla.com" className="text-navy-900 hover:underline">kvkk@takasla.com</a>{' '}
            adresinden bize ulasin.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/kvkk" className="text-sm text-navy-900 hover:underline">KVKK Aydinlatma Metni</Link>
            <Link href="/terms" className="text-sm text-navy-900 hover:underline">Kullanim Kosullari</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyContentEN() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: March 22, 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Overview</h2>
          <p className="text-slate-600 leading-relaxed">
            At Takasla (&quot;we&quot;, &quot;Platform&quot;), we value your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our Platform.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            This policy is prepared in accordance with the Turkish Personal Data Protection Law No. 6698 (KVKK) and applicable regulations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-slate-700 mt-4 mb-2">2.1 Information You Provide</h3>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>During registration: email address, password, display name</li>
            <li>Profile information: bio, location, profile photos</li>
            <li>Listing information: product title, description, photos, price, category</li>
            <li>Address information: name, address, phone number for shipping</li>
            <li>Messages: conversations with other users</li>
            <li>Dispute evidence: photos, videos, documents, text descriptions</li>
          </ul>

          <h3 className="text-lg font-medium text-slate-700 mt-4 mb-2">2.2 Automatically Collected Information</h3>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>IP address and browser information</li>
            <li>Access logs and usage statistics</li>
            <li>EXIF metadata from images (stripped after processing)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Cookies and Local Storage</h2>
          <p className="text-slate-600 leading-relaxed">
            Our Platform <strong>does not use cookies</strong>. Authentication tokens are stored in your browser&apos;s local storage (localStorage). This data is kept only on your device and is not automatically sent to servers.
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1 mt-3">
            <li><strong>accessToken:</strong> Session authentication (JWT)</li>
            <li><strong>refreshToken:</strong> Session renewal</li>
            <li><strong>userId:</strong> User identifier</li>
            <li><strong>locale:</strong> Your language preference (TR/EN)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Create and manage your account</li>
            <li>Facilitate trade transactions</li>
            <li>Provide shipping services</li>
            <li>Process payments</li>
            <li>Ensure platform security and detect fraud</li>
            <li>Resolve disputes</li>
            <li>Calculate trust scores</li>
            <li>Generate blockchain certificates</li>
            <li>Send you notifications and updates</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Information Sharing</h2>
          <p className="text-slate-600 leading-relaxed mb-3">
            We do not share your personal data with third parties except in the following cases:
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Service providers:</strong> Email delivery (Brevo), file storage (Cloudflare R2), payment processing (Stripe), content moderation (SightEngine), shipping (Geliver, EasyPost)</li>
            <li><strong>Other users:</strong> Shipping addresses are shared with the counterparty during trade transactions</li>
            <li><strong>Legal requirements:</strong> When required by court order or legal regulation</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            We never sell your personal data to third parties for advertising or marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Data Security</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Passwords are stored hashed with bcrypt</li>
            <li>All data transfers are encrypted with SSL/TLS</li>
            <li>GPS coordinates and camera information are automatically stripped from uploaded images</li>
            <li>Each service is isolated in its own database</li>
            <li>JWT-based access control and role-based authorization</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Your Rights</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Right to access:</strong> Download all your data from the profile page using &quot;Download My Data&quot;</li>
            <li><strong>Right to correction:</strong> Update your information from your profile page</li>
            <li><strong>Right to deletion:</strong> Permanently delete your account and all data from your profile page</li>
            <li><strong>Right to objection:</strong> Object to results of automated processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Changes</h2>
          <p className="text-slate-600 leading-relaxed">
            We may update this Privacy Policy from time to time. You will be notified of significant changes via your registered email address. Continued use of the Platform constitutes acceptance of the updated policy.
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            For questions, contact us at{' '}
            <a href="mailto:kvkk@takasla.com" className="text-navy-900 hover:underline">kvkk@takasla.com</a>.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/kvkk" className="text-sm text-navy-900 hover:underline">KVKK Data Processing Notice</Link>
            <Link href="/terms" className="text-sm text-navy-900 hover:underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
