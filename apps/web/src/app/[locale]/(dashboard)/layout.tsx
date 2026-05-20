import { AuthProvider } from '../../../hooks/useAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600">NourPlay</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Dashboard</span>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </div>
    </AuthProvider>
  )
}
