import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ConfirmationPage } from './pages/ConfirmationPage'
import { UnsubscribePage } from './pages/UnsubscribePage'
import { ArchivePage } from './pages/ArchivePage'
import { SummaryDetailPage } from './pages/SummaryDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/confirm" element={<ConfirmationPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/summary/:id" element={<SummaryDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  )
}

export default App
