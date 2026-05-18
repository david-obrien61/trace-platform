import { Link } from 'react-router-dom';

interface NavBarProps {
  title?: string;
  backTo?: string;
  backLabel?: string;
}

export function NavBar({ title, backTo, backLabel = 'Back' }: NavBarProps) {
  return (
    <header style={{
      background: 'var(--green-primary)',
      color: 'var(--white)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {backTo && (
        <Link
          to={backTo}
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
          }}
        >
          ← {backLabel}
        </Link>
      )}
      {title && (
        <span style={{ fontWeight: 600, fontSize: '1rem', flex: 1 }}>
          {title}
        </span>
      )}
    </header>
  );
}
