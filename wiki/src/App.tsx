import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CategoryPage from './pages/CategoryPage'
import ArticlePage from './pages/ArticlePage'
import SearchResultsPage from './pages/SearchResultsPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/:category" element={<CategoryPage />} />
        <Route path="/:category/:slug" element={<ArticlePage />} />
      </Routes>
    </Layout>
  )
}

export default App
