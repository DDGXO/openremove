import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import BrandingConsole from '@/components/BrandingConsole';

const siteUrl = 'https://openremove.dgxohq.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'OpenRemove - Free & Automatic AI Background Remover',
    template: '%s | OpenRemove',
  },
  description:
    '100% Automatic, Lossless & Free AI Background Remover powered by private on-device SOTA neural models (BEN2, RMBG-1.4, Silueta, IS-Net).',
  keywords: [
    'background remover',
    'hapus background',
    'remove bg',
    'ai background removal',
    'ben2',
    'rmbg',
    'silueta',
    'isnet',
    'openremove',
    'dgxo',
    'hapus latar belakang gambar',
    'free background remover',
  ],
  authors: [{ name: 'DGXO', url: 'https://dgxohq.com' }],
  creator: 'DGXO',
  publisher: 'DGXO',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    alternateLocale: 'en_US',
    url: siteUrl,
    siteName: 'OpenRemove',
    title: 'OpenRemove - Free & Automatic AI Background Remover',
    description:
      '100% Automatic, Lossless & Free AI Background Remover powered by private on-device SOTA neural models.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OpenRemove AI Background Remover',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenRemove - Free & Automatic AI Background Remover',
    description:
      '100% Automatic, Lossless & Free AI Background Remover powered by private on-device SOTA neural models.',
    images: ['/og-image.png'],
    creator: '@DDGXO',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'DGXO',
      url: 'https://dgxohq.com',
      logo: `${siteUrl}/logo.png`,
      sameAs: [
        'https://github.com/DDGXO',
        'https://github.com/DGameXO',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'OpenRemove',
      description: '100% Automatic, Lossless & Free AI Background Remover powered by SOTA models.',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: 'OpenRemove',
      url: siteUrl,
      description: 'Free, lossless, automatic background removal running on-device with private neural networks.',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      publisher: { '@id': `${siteUrl}/#organization` },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
        <LanguageProvider>
          <BrandingConsole />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
