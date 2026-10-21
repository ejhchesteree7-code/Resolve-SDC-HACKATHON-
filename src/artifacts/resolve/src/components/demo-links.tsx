import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import './demo-links.css';

const outlets = [
  { id: 'bangsar', name: 'Brew & Kin — Bangsar' },
  { id: 'mont-kiara', name: 'Brew & Kin — Mont Kiara' },
];

export default function DemoLinks() {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const links = outlets.map(outlet => ({
    ...outlet,
    url: new URL(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}p/${outlet.id}`, window.location.origin).href,
  }));
  useEffect(() => {
    let active = true;
    Promise.all(links.map(async outlet => [outlet.id, await QRCode.toDataURL(outlet.url, { width: 120, margin: 1 })] as const))
      .then(entries => { if (active) setCodes(Object.fromEntries(entries)); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return (
    <details className="demo-links" data-testid="demo-links">
      <summary>Demo links <span>Open a simulated public café listing</span></summary>
      <div className="demo-links-grid">
        {links.map(outlet => (
          <div className="demo-link" key={outlet.id}>
            {codes[outlet.id] && <img src={codes[outlet.id]} width="100" height="100" alt={`QR code for ${outlet.name} public reviews`} />}
            <div><strong>{outlet.name}</strong><a href={outlet.url} target="_blank" rel="noreferrer">{outlet.url}</a></div>
          </div>
        ))}
      </div>
      {error && <p role="alert">QR codes could not load. You can still open the links above.</p>}
    </details>
  );
}
