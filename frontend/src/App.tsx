import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui'
import { DashboardPage } from "./features/dashboard/DashboardPage"
import TransactionsPage from "./pages/Transactions"
import RecurringPage from "./pages/Recurring"
import { SimulationPage } from "./pages/Simulation"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
