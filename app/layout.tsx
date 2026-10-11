export const metadata = {
  title: 'TrustShip',
  description: 'WhatsApp-native escrow platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
