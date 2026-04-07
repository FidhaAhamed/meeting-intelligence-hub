function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Meeting Intelligence Hub</h1>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
          API connected
        </span>
      </div>
    </nav>
  )
}

export default Navbar