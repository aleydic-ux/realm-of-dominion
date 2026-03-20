const VARIANTS = {
  error: 'bg-red-900/30 border-red-700 text-red-300',
  success: 'bg-green-900/30 border-green-700 text-green-300',
};

export default function AlertBanner({ type = 'error', message }) {
  if (!message) return null;
  return (
    <div className={`border px-3 py-2 rounded text-sm ${VARIANTS[type] || VARIANTS.error}`}>
      {message}
    </div>
  );
}
