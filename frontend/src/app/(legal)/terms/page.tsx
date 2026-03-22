'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';

export default function TermsPage() {
  const { locale } = useTranslation();

  if (locale === 'tr') {
    return <TermsContentTR />;
  }
  return <TermsContentEN />;
}

function TermsContentTR() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Kullanim Kosullari</h1>
      <p className="text-sm text-slate-500 mb-8">Son guncelleme: 22 Mart 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Kabul</h2>
          <p className="text-slate-600 leading-relaxed">
            Takasla platformuna (&quot;Platform&quot;) kayit olarak veya Platformu kullanarak bu Kullanim Kosullari&apos;ni kabul etmis sayilirsiniz. Bu kosullari kabul etmiyorsaniz Platformu kullanmayiniz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Hizmet Tanimi</h2>
          <p className="text-slate-600 leading-relaxed">
            Takasla, kullanicilarin yüksek degerli urunleri guvenli bir sekilde takas etmelerini saglayan bir C2C (tuketiciden-tuketiciye) platformudur. Platform; risk tabanli emanet, kanit dogrulama, blockchain sertifikalama ve anlasmazlik cozum hizmetleri sunmaktadir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Hesap Olusturma</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Platform&apos;a kayit olmak icin 18 yasindan buyuk olmaniz gerekmektedir</li>
            <li>Dogru ve guncel bilgiler saglamakla yukumlusunuz</li>
            <li>Hesap guvenliginizden siz sorumlusunuz</li>
            <li>Her kullanici yalnizca bir hesap olusturabilir</li>
            <li>E-posta dogrulama zorunludur</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Ilan Kurallari</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Ilanlar gercek, fiziksel urunler icin olmalidir</li>
            <li>Urun aciklamalari ve fotograflar dogru ve gercekci olmalidir</li>
            <li>Yapay zeka ile uretilmis gorseller tespit edilebilir ve ilanlar kaldirilabilir</li>
            <li>Beyan edilen deger gercekci olmalidir</li>
            <li>Ayni urunu birden fazla ilan olarak yayinlamak yasaktir</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Yasakli Urunler</h2>
          <p className="text-slate-600 leading-relaxed mb-3">Asagidaki urunlerin ilanlanmasi kesinlikle yasaktir:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Silah, mucizve ve patlayici maddeler</li>
            <li>Uyusturucu ve yasal olmayan maddeler</li>
            <li>Sahte veya taklit urunler</li>
            <li>Calinti urunler</li>
            <li>Canli hayvanlar</li>
            <li>Yasa disi veya kisitli urunler</li>
            <li>Telif hakki veya fikri mulkiyet ihlali iceren urunler</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Takas Kurallari</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Takas islemleri Platform&apos;un risk tabanli emanet sistemi uzerinden yurutulur</li>
            <li>Her iki taraf da kanit fotograflari ve belgeleri saglamakla yukumludur</li>
            <li>Yuksek riskli takaslar ek dogrulama adimlari gerektirebilir</li>
            <li>Platform ucretleri takas isleminin tamamlanmasindan once odenir</li>
            <li>Anlasmazlik suresi icinde itiraz hakkiniz bulunmaktadir</li>
            <li>Takas tamamlandiktan sonra blockchain sertifikasi olusturulur</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Platform Ucretleri</h2>
          <p className="text-slate-600 leading-relaxed">
            Platform, takas islemleri icin kategori bazli islem ucreti almaktadir. Ucretler takas oncesinde acikca gosterilir ve her iki taraftan da tahsil edilir. Ilan one cikarma (featured/spotlight) hizmetleri ayri ucretlendirilir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Anlasmazlik Cozumu</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Takas tamamlandiktan sonra belirlenen sure icinde itiraz acilabilir</li>
            <li>Itirazlar kanit yukleme ve moderator incelemesiyle degerlendirilir</li>
            <li>Moderator kararlari, itiraz suresi icinde itiraz edilebilir</li>
            <li>Platform, anlasmazliklarda nihai karar verme hakkini sakli tutar</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. Fikri Mulkiyet</h2>
          <p className="text-slate-600 leading-relaxed">
            Platform&apos;un tasarimi, kodu, markasi ve icerigi Takasla&apos;ya aittir. Kullanicilarin yukledigi icerikler uzerindeki haklar kullaniciya ait kalir; ancak Platform&apos;a yukleme yaparak iceriginin Platform hizmetleri icin kullanilmasina izin vermis sayilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">10. Sorumluluk Sinirlamasi</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Platform, kullanicilar arasindaki takas islemlerinde aracidir</li>
            <li>Urunlerin kalitesi, orijinalligi veya durumu konusunda garanti vermez</li>
            <li>Kargo sureclerinde olusabilecek hasar veya kayiplardan sorumlu degildir</li>
            <li>Kullanicilar arasindaki anlasmazliklardan dogrudan sorumlu degildir</li>
            <li>Platform, hizmet kesintileri veya teknik arizalardan dolayi sorumluluk kabul etmez</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">11. Hesap Askiya Alma ve Kapatma</h2>
          <p className="text-slate-600 leading-relaxed">
            Platform, bu kosullari ihlal eden, dolandiricilik faaliyetlerinde bulunan veya diger kullanicilara zarar veren hesaplari uyari vermeksizin askiya alabilir veya kalici olarak kapatabilir. Yasaklanan kullanicilar ayni e-posta adresiyle yeniden kayit yapamazlar.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">12. Degisiklikler</h2>
          <p className="text-slate-600 leading-relaxed">
            Bu Kullanim Kosullari&apos;ni onemli degisikliklerde en az 30 gun oncesinden e-posta ile bildirimde bulunarak guncelleyebiliriz. Platformu kullanmaya devam etmeniz, guncellenmis kosullari kabul ettiginiz anlamina gelir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">13. Uygulanacak Hukuk</h2>
          <p className="text-slate-600 leading-relaxed">
            Bu Kullanim Kosullari Turkiye Cumhuriyeti kanunlarina tabidir. Anlasmazliklar Istanbul mahkemelerinde cozumlenecektir.
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Sorulariniz icin{' '}
            <a href="mailto:destek@takasla.com" className="text-navy-900 hover:underline">destek@takasla.com</a>{' '}
            adresinden bize ulasin.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/kvkk" className="text-sm text-navy-900 hover:underline">KVKK Aydinlatma Metni</Link>
            <Link href="/privacy" className="text-sm text-navy-900 hover:underline">Gizlilik Politikasi</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TermsContentEN() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: March 22, 2026</p>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Acceptance</h2>
          <p className="text-slate-600 leading-relaxed">
            By registering for or using the Takasla platform (&quot;Platform&quot;), you agree to these Terms of Service. If you do not agree to these terms, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Service Description</h2>
          <p className="text-slate-600 leading-relaxed">
            Takasla is a C2C (consumer-to-consumer) platform that enables users to exchange high-value goods securely. The Platform provides risk-based escrow, proof verification, blockchain certification, and dispute resolution services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Account Creation</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>You must be at least 18 years old to register on the Platform</li>
            <li>You are responsible for providing accurate and up-to-date information</li>
            <li>You are responsible for your account security</li>
            <li>Each user may only create one account</li>
            <li>Email verification is mandatory</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Listing Rules</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Listings must be for real, physical products</li>
            <li>Product descriptions and photos must be accurate and realistic</li>
            <li>AI-generated images may be detected and listings may be removed</li>
            <li>Declared value must be realistic</li>
            <li>Duplicate listings for the same product are prohibited</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Prohibited Items</h2>
          <p className="text-slate-600 leading-relaxed mb-3">The following items are strictly prohibited:</p>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Weapons, ammunition, and explosives</li>
            <li>Drugs and illegal substances</li>
            <li>Counterfeit or replica products</li>
            <li>Stolen goods</li>
            <li>Live animals</li>
            <li>Illegal or restricted products</li>
            <li>Products that infringe copyrights or intellectual property</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Trade Rules</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Trade transactions are conducted through the Platform&apos;s risk-based escrow system</li>
            <li>Both parties are required to provide proof photos and documentation</li>
            <li>High-risk trades may require additional verification steps</li>
            <li>Platform fees are paid before trade completion</li>
            <li>You have the right to dispute within the designated dispute window</li>
            <li>A blockchain certificate is generated after trade completion</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Platform Fees</h2>
          <p className="text-slate-600 leading-relaxed">
            The Platform charges category-based transaction fees for trade transactions. Fees are clearly shown before trading and are collected from both parties. Listing promotion services (featured/spotlight) are priced separately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Dispute Resolution</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>Disputes can be opened within the designated period after trade completion</li>
            <li>Disputes are evaluated through evidence upload and moderator review</li>
            <li>Moderator decisions can be appealed within the appeal window</li>
            <li>The Platform reserves the right to make final decisions in disputes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. Intellectual Property</h2>
          <p className="text-slate-600 leading-relaxed">
            The Platform&apos;s design, code, brand, and content belong to Takasla. Rights to user-uploaded content remain with the user; however, by uploading content, you grant the Platform permission to use it for Platform services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">10. Limitation of Liability</h2>
          <ul className="list-disc pl-6 text-slate-600 space-y-1">
            <li>The Platform is an intermediary in trade transactions between users</li>
            <li>It does not guarantee the quality, authenticity, or condition of products</li>
            <li>It is not responsible for damage or loss during shipping</li>
            <li>It is not directly responsible for disputes between users</li>
            <li>The Platform does not accept liability for service interruptions or technical failures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">11. Account Suspension and Termination</h2>
          <p className="text-slate-600 leading-relaxed">
            The Platform may suspend or permanently close accounts that violate these terms, engage in fraud, or harm other users without prior notice. Banned users cannot re-register with the same email address.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">12. Changes</h2>
          <p className="text-slate-600 leading-relaxed">
            We may update these Terms of Service with at least 30 days&apos; notice via email for significant changes. Continued use of the Platform constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">13. Governing Law</h2>
          <p className="text-slate-600 leading-relaxed">
            These Terms of Service are governed by the laws of the Republic of Turkey. Disputes will be resolved in Istanbul courts.
          </p>
        </section>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            For questions, contact us at{' '}
            <a href="mailto:destek@takasla.com" className="text-navy-900 hover:underline">destek@takasla.com</a>.
          </p>
          <div className="flex gap-4 mt-4">
            <Link href="/kvkk" className="text-sm text-navy-900 hover:underline">KVKK Data Processing Notice</Link>
            <Link href="/privacy" className="text-sm text-navy-900 hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
