import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Cases from './pages/Cases.jsx'
import CaseView from './pages/CaseView.jsx'
import Sheets from './pages/Sheets.jsx'
import SheetView from './pages/SheetView.jsx'
import Protocol from './pages/Protocol.jsx'
import Stats from './pages/Stats.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseView />} />
        <Route path="/sheets" element={<Sheets />} />
        <Route path="/sheets/:id" element={<SheetView />} />
        <Route path="/protocol" element={<Protocol />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}
