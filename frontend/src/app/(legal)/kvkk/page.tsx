'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

export default function KVKKPage() {
  const { locale } = useTranslation();

  if (locale === 'tr') {
    return <KVKKContentTR />;
  }
  return <KVKKContentEN />;
}

function KVKKContentTR() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">KVKK Aydinlatma Metni</h1>
      <p className="text-sm text-slate-500 mb-8">Son guncelleme: 22 Mart 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Veri Sorumlusu</h2>
          <p className="text-slate-600 leading-relaxed">
            6698 sayili Kisisel Verilerin Korunmasi Kanunu (&quot;KVKK&quot;) kapsaminda, kisisel verileriniz veri sorumlusu sifatiyla <strong>Takasla</strong> (&quot;Platform&quot;) tarafindan asagida aciklanan amaclarla ve yontemlerle islenebilecektir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Islenen Kisisel Veriler</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Platformumuz tarafindan asagidaki kisisel veriler islenebilmektedir:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Kimlik Bilgileri:</strong> Ad soyad, gorünen ad</li>
            <li><strong>Iletisim Bilgileri:</strong> E-posta adresi, telefon numarasi, posta adresi</li>
            <li><strong>Hesap Bilgileri:</strong> Kullanici ID, sifre hash, hesap olusturma tarihi, rol</li>
            <li><strong>Islem Bilgileri:</strong> Ilan detaylari, takas gecmisi, teklif gecmisi, odeme bilgileri</li>
            <li><strong>Gorsel Veriler:</strong> Urun fotograflari, profil fotograflari, kanit gorselleri</li>
            <li><strong>Konum Bilgileri:</strong> Sehir, ilce, mahalle (ilan ve kargo icin)</li>
            <li><strong>Itibar Verileri:</strong> Guven puani, degerlendirmeler, risk isaretleri</li>
            <li><strong>Teknik Veriler:</strong> IP adresi, tarayici bilgileri, erisim kayitlari</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Kisisel Verilerin Islenme Amaclari</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Kisisel verileriniz asagidaki amaclarla islenmektedir:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Uyelik kaydinin olusturulmasi ve hesap yonetimi</li>
            <li>Kimlik dogrulama ve e-posta dogrulama islemleri</li>
            <li>Takas islemlerinin gerceklestirilmesi ve yonetimi</li>
            <li>Kargo ve teslimat hizmetlerinin saglanmasi</li>
            <li>Odeme islemlerinin gerceklestirilmesi</li>
            <li>Platform guvenliginin saglanmasi ve dolandiricilik onleme</li>
            <li>Anlasmazlik cozum sureclerinin yurutulmesi</li>
            <li>Blockchain sertifika ve dogrulama hizmetleri</li>
            <li>Kullanici destek hizmetlerinin saglanmasi</li>
            <li>Yasal yukumluluklerin yerine getirilmesi</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Kisisel Verilerin Islenmesinin Hukuki Sebepleri</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Kisisel verileriniz KVKK&apos;nin 5. maddesi kapsaminda asagidaki hukuki sebeplere dayanilarak islenmektedir:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Acik riza:</strong> Pazarlama iletisimleri, profil fotografi yukleme</li>
            <li><strong>Sozlesmenin kurulmasi ve ifasi:</strong> Hesap olusturma, takas islemleri, kargo hizmetleri</li>
            <li><strong>Hukuki yukumluluk:</strong> Yasal bildirimler, vergi yukumlulukleri</li>
            <li><strong>Mesru menfaat:</strong> Platform guvenligi, dolandiricilik tespiti, hizmet iyilestirme</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Kisisel Verilerin Aktarilmasi</h2>
          <p className="text-slate-600 leading-relaxed mb-3">
            Kisisel verileriniz, hizmet sunumu icin asagidaki ücüncü taraflarla paylasalabilmektedir:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Hizmet Saglayici</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Paylasilan Veri</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Amac</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Ulke</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="border-b"><td className="px-4 py-2">Brevo (Sendinblue)</td><td className="px-4 py-2">E-posta adresi</td><td className="px-4 py-2">E-posta gonderimi</td><td className="px-4 py-2">Fransa (AB)</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Cloudflare R2</td><td className="px-4 py-2">Yuklenen gorseller</td><td className="px-4 py-2">Dosya depolama</td><td className="px-4 py-2">ABD / Global</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Stripe</td><td className="px-4 py-2">Odeme bilgileri, e-posta</td><td className="px-4 py-2">Odeme isleme</td><td className="px-4 py-2">ABD</td></tr>
                <tr className="border-b"><td className="px-4 py-2">SightEngine</td><td className="px-4 py-2">Yuklenen gorseller</td><td className="px-4 py-2">Yapay zeka icerik denetimi</td><td className="px-4 py-2">Fransa (AB)</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Geliver</td><td className="px-4 py-2">Kargo adresi, ad</td><td className="px-4 py-2">Yurt ici kargo</td><td className="px-4 py-2">Turkiye</td></tr>
                <tr><td className="px-4 py-2">EasyPost</td><td className="px-4 py-2">Kargo adresi, ad</td><td className="px-4 py-2">Uluslararasi kargo</td><td className="px-4 py-2">ABD</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mt-3">
            Yurt disina veri aktarimi, KVKK&apos;nin 9. maddesi kapsaminda yeterli koruma bulunan ulkelere veya standart sozlesme hukumleri (SCC) cercevesinde gerceklestirilmektedir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Kisisel Verilerin Saklanma Suresi</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Hesap verileri:</strong> Hesap aktif oldugu surece + hesap silindikten sonra 30 gun</li>
            <li><strong>Takas ve islem kayitlari:</strong> Islemin tamamlanmasindan itibaren 2 yil (ticari yasal saklama yukumlulugu)</li>
            <li><strong>Odeme kayitlari:</strong> Islemden itibaren 2 yil (mali denetim yukumlulugu)</li>
            <li><strong>Anlasmazlik kayitlari:</strong> Cozumden itibaren 2 yil</li>
            <li><strong>E-posta dogrulama tokenlari:</strong> 24 saat (kullanildiktan veya suresi dolduktan sonra)</li>
            <li><strong>Oturum tokenlari:</strong> 7 gun (yenileme tokeni suresi)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Ilgili Kisi Olarak Haklariniz (Madde 11)</h2>
          <p className="text-slate-600 leading-relaxed mb-3">KVKK&apos;nin 11. maddesi uyarinca asagidaki haklara sahipsiniz:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Kisisel verilerinizin islenip islenmedigini ogrenme</li>
            <li>Kisisel verileriniz islenmisse buna iliskin bilgi talep etme</li>
            <li>Kisisel verilerinizin islenme amacini ve bunlarin amacina uygun kullanilip kullanilmadigini ogrenme</li>
            <li>Yurt icinde veya yurt disinda kisisel verilerinizin aktarildigi ucuncu kisileri bilme</li>
            <li>Kisisel verilerinizin eksik veya yanlis islenmis olmasi halinde bunlarin duzeltilmesini isteme</li>
            <li>KVKK&apos;nin 7. maddesinde ongorulen sartlar cercevesinde kisisel verilerinizin silinmesini veya yok edilmesini isteme</li>
            <li>Duzeltme ve silme islemlerinin, kisisel verilerinizin aktarildigi ucuncu kisilere bildirilmesini isteme</li>
            <li>Islenen verilerin munhasiran otomatik sistemler vasitasiyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya cikmasina itiraz etme</li>
            <li>Kisisel verilerinizin kanuna aykiri olarak islenmesi sebebiyle zarara ugramaniz halinde zararin giderilmesini talep etme</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Basvuru Yontemi</h2>
          <p className="text-slate-600 leading-relaxed">
            Yukaridaki haklarinizi kullanmak icin asagidaki yontemlerden birini kullanabilirsiniz:
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1 mt-3">
            <li><strong>Veri indirme:</strong> Profil sayfanizdan &quot;Verilerimi Indir&quot; secenegini kullanarak kisisel verilerinizi JSON formatinda indirebilirsiniz</li>
            <li><strong>Hesap silme:</strong> Profil sayfanizdan hesabinizi ve tum ilisikili verilerinizi kalici olarak silebilirsiniz</li>
            <li><strong>E-posta:</strong> kvkk@takasla.com adresine basvuruda bulunabilirsiniz</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Basvurulariniz en gec 30 gun icinde ucretsiz olarak yanitlanacaktir. Islemin ayrica bir maliyet gerektirmesi halinde, Kisisel Verileri Koruma Kurulu tarafindan belirlenen ucret tarifesi uygulanacaktir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. Guvenlik Onlemleri</h2>
          <p className="text-slate-600 leading-relaxed">
            Kisisel verilerinizin guvenligini saglamak icin asagidaki teknik ve idari tedbirler alinmaktadir:
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1 mt-3">
            <li>Sifreler bcrypt ile hash&apos;lenerek saklanmaktadir</li>
            <li>Tum iletisim SSL/TLS ile sifrelenmektedir</li>
            <li>JWT tabanli kimlik dogrulama ve yetkilendirme</li>
            <li>Yuklenen gorsellerden EXIF meta verileri (GPS koordinatlari dahil) otomatik olarak temizlenmektedir</li>
            <li>Dagitik kilit mekanizmasi ile es zamanli islem guvenligi</li>
            <li>Duzenli veri saklama suresi denetimi ve otomatik temizlik</li>
          </ul>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Bu aydinlatma metni hakkinda sorulariniz icin{' '}
            <a href="mailto:kvkk@takasla.com" className="text-navy-900 hover:underline">kvkk@takasla.com</a>{' '}
            adresinden bizimle iletisime gecebilirsiniz.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/privacy" className="text-sm text-navy-900 hover:underline">Gizlilik Politikasi</Link>
            <Link href="/terms" className="text-sm text-navy-900 hover:underline">Kullanim Kosullari</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KVKKContentEN() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">KVKK Data Processing Notice</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: March 22, 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Data Controller</h2>
          <p className="text-slate-600 leading-relaxed">
            Under the Turkish Personal Data Protection Law No. 6698 (&quot;KVKK&quot;), your personal data is processed by <strong>Takasla</strong> (&quot;Platform&quot;) as the data controller, for the purposes and methods described below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Personal Data Collected</h2>
          <p className="text-slate-600 leading-relaxed mb-3">The following personal data may be processed by our Platform:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Identity Data:</strong> Full name, display name</li>
            <li><strong>Contact Data:</strong> Email address, phone number, postal address</li>
            <li><strong>Account Data:</strong> User ID, password hash, account creation date, role</li>
            <li><strong>Transaction Data:</strong> Listing details, trade history, offer history, payment information</li>
            <li><strong>Visual Data:</strong> Product photos, profile photos, proof images</li>
            <li><strong>Location Data:</strong> City, district, neighbourhood (for listings and shipping)</li>
            <li><strong>Reputation Data:</strong> Trust score, ratings, risk flags</li>
            <li><strong>Technical Data:</strong> IP address, browser information, access logs</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Purposes of Processing</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Account creation and management</li>
            <li>Identity and email verification</li>
            <li>Facilitating and managing trade transactions</li>
            <li>Providing shipping and delivery services</li>
            <li>Processing payments</li>
            <li>Ensuring platform security and fraud prevention</li>
            <li>Managing dispute resolution processes</li>
            <li>Blockchain certification and verification services</li>
            <li>Providing customer support</li>
            <li>Fulfilling legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Legal Basis for Processing</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Your personal data is processed under KVKK Article 5 based on the following legal grounds:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Explicit consent:</strong> Marketing communications, profile photo upload</li>
            <li><strong>Contractual necessity:</strong> Account creation, trade transactions, shipping services</li>
            <li><strong>Legal obligation:</strong> Legal notifications, tax obligations</li>
            <li><strong>Legitimate interest:</strong> Platform security, fraud detection, service improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Data Transfers</h2>
          <p className="text-slate-600 leading-relaxed mb-3">
            Your personal data may be shared with the following third parties for service delivery:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Service Provider</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Data Shared</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Purpose</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-b">Country</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="border-b"><td className="px-4 py-2">Brevo (Sendinblue)</td><td className="px-4 py-2">Email address</td><td className="px-4 py-2">Email delivery</td><td className="px-4 py-2">France (EU)</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Cloudflare R2</td><td className="px-4 py-2">Uploaded images</td><td className="px-4 py-2">File storage</td><td className="px-4 py-2">USA / Global</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Stripe</td><td className="px-4 py-2">Payment info, email</td><td className="px-4 py-2">Payment processing</td><td className="px-4 py-2">USA</td></tr>
                <tr className="border-b"><td className="px-4 py-2">SightEngine</td><td className="px-4 py-2">Uploaded images</td><td className="px-4 py-2">AI content moderation</td><td className="px-4 py-2">France (EU)</td></tr>
                <tr className="border-b"><td className="px-4 py-2">Geliver</td><td className="px-4 py-2">Shipping address, name</td><td className="px-4 py-2">Domestic shipping</td><td className="px-4 py-2">Turkey</td></tr>
                <tr><td className="px-4 py-2">EasyPost</td><td className="px-4 py-2">Shipping address, name</td><td className="px-4 py-2">International shipping</td><td className="px-4 py-2">USA</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mt-3">
            Cross-border data transfers are conducted under KVKK Article 9, to countries with adequate protection or under Standard Contractual Clauses (SCCs).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Data Retention Periods</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li><strong>Account data:</strong> While account is active + 30 days after deletion</li>
            <li><strong>Trade and transaction records:</strong> 2 years from transaction completion (commercial legal retention)</li>
            <li><strong>Payment records:</strong> 2 years from transaction (financial audit obligation)</li>
            <li><strong>Dispute records:</strong> 2 years from resolution</li>
            <li><strong>Email verification tokens:</strong> 24 hours (after use or expiry)</li>
            <li><strong>Session tokens:</strong> 7 days (refresh token lifespan)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Your Rights (Article 11)</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Under KVKK Article 11, you have the following rights:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Learn whether your personal data is being processed</li>
            <li>Request information about the processing of your personal data</li>
            <li>Learn the purpose of processing and whether data is used in accordance with its purpose</li>
            <li>Know the third parties to whom your personal data is transferred</li>
            <li>Request correction of incomplete or inaccurate personal data</li>
            <li>Request deletion or destruction of personal data under KVKK Article 7</li>
            <li>Request notification of correction and deletion operations to third parties</li>
            <li>Object to any result arising from the analysis of processed data exclusively through automated systems</li>
            <li>Claim compensation for damages arising from unlawful processing of personal data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. How to Exercise Your Rights</h2>
          <p className="text-slate-600 leading-relaxed">
            You can exercise your rights through the following methods:
          </p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1 mt-3">
            <li><strong>Data download:</strong> Use the &quot;Download My Data&quot; option on your profile page to download your personal data in JSON format</li>
            <li><strong>Account deletion:</strong> Permanently delete your account and all associated data from your profile page</li>
            <li><strong>Email:</strong> Submit a request to kvkk@takasla.com</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Your requests will be answered free of charge within 30 days at the latest. If the process requires additional costs, the fee schedule determined by the Personal Data Protection Board will apply.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. Security Measures</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Passwords are stored hashed with bcrypt</li>
            <li>All communications are encrypted with SSL/TLS</li>
            <li>JWT-based authentication and authorization</li>
            <li>EXIF metadata (including GPS coordinates) is automatically stripped from uploaded images</li>
            <li>Distributed locking mechanism for concurrent transaction security</li>
            <li>Regular data retention audits and automatic cleanup</li>
          </ul>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            For questions about this notice, contact us at{' '}
            <a href="mailto:kvkk@takasla.com" className="text-navy-900 hover:underline">kvkk@takasla.com</a>.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/privacy" className="text-sm text-navy-900 hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-navy-900 hover:underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
