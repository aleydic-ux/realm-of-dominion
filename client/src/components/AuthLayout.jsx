export default function AuthLayout({ children, subtitle, maxWidth = 'max-w-md' }) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('/MAIN PAGE BACKGROUND.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(6,14,28,0.50) 0%, rgba(6,14,28,0.88) 100%)' }}
      />
      <div className={`w-full ${maxWidth} relative z-10`}>
        <div className="text-center mb-10">
          <h1 className="text-realm-gold font-display" style={{ fontSize: '3.2rem', letterSpacing: '0.12em', textShadow: '2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(200,160,72,0.4)' }}>
            Realm of Dominion
          </h1>
          {subtitle && (
            <p className="text-realm-text-muted mt-3 uppercase tracking-widest" style={{ letterSpacing: '0.25em', fontSize: '0.8rem' }}>{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
