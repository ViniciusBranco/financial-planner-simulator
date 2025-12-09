import { LayoutDashboard, Receipt, Settings, PieChart, Repeat, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link, useLocation } from 'react-router-dom'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const pathname = location.pathname

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-card hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                        <PieChart className="w-6 h-6" />
                        Finances 2025
                    </h1>
                </div>
                <nav className="flex-1 px-4 space-y-2">
                    <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" active={pathname === '/'} />
                    <NavItem to="/transactions" icon={<Receipt />} label="Transactions" active={pathname === '/transactions'} />
                    <NavItem to="/recurring" icon={<Repeat />} label="Recurring" active={pathname === '/recurring'} />
                    <NavItem to="/simulation" icon={<LineChart />} label="Simulation" active={pathname === '/simulation'} />
                    <NavItem to="/settings" icon={<Settings />} label="Settings" active={pathname === '/settings'} />
                </nav>
            </aside>


            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8 max-w-7xl mx-auto space-y-8">
                    {children}
                </div>
            </main>
        </div>
    )
}

function NavItem({ icon, label, active, to }: { icon: React.ReactNode; label: string; active?: boolean; to: string }) {
    return (
        <Link
            to={to}
            className={cn(
                "flex items-center gap-3 w-full px-4 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {icon}
            {label}
        </Link>
    )
}
