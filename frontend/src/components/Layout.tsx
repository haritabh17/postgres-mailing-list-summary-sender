import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun, Rss, Github } from 'lucide-react'
import { Logo } from './Logo'
import { useTheme } from '../context/ThemeContext'

const NAV_LINKS = [
  { to: '/', label: 'Latest' },
  { to: '/archive', label: 'Archive' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-surface-secondary dark:bg-surface-dark">
      <header className="sticky top-0 z-50 border-b border-surface-border dark:border-surface-dark-border bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <Logo className="h-8 w-8" />
              <span className="font-semibold text-gray-900 dark:text-white group-hover:text-pg-700 dark:group-hover:text-accent-400 transition-colors">
                PostgreSQL Hackers Digest
              </span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === to
                      ? 'text-pg-700 bg-pg-50 dark:text-accent-400 dark:bg-pg-900/40'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-pg-900/20'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <a
                href="/rss.xml"
                className="p-2 rounded-lg text-gray-500 hover:text-pg-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-accent-400 dark:hover:bg-pg-900/20 transition-colors"
                title="RSS feed"
                aria-label="RSS feed"
              >
                <Rss className="h-4 w-4" />
              </a>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-pg-900/20 transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      <footer className="border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <p>
              Not affiliated with the PostgreSQL Global Development Group.
              Summaries are AI-generated and may not capture all nuances.
            </p>
            <div className="flex items-center gap-4 whitespace-nowrap">
              <span>
                Built by{' '}
                <a
                  href="https://github.com/haritabh17"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-700 dark:text-gray-300 hover:text-pg-700 dark:hover:text-accent-400 transition-colors"
                >
                  Haritabh Gupta
                </a>
              </span>
              <a
                href="https://github.com/haritabh17/postgres-mailing-list-summary-sender"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-pg-700 dark:hover:text-accent-400 transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                Source
              </a>
              <Link to="/unsubscribe" className="hover:text-pg-700 dark:hover:text-accent-400 transition-colors">
                Unsubscribe
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
