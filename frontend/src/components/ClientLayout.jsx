import Sidebar from './Sidebar';
import ClientSidebar from './ClientSidebar';
import Header from './Header';

export default function ClientLayout({ client, children }) {
  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <ClientSidebar client={client} />
      <div className="flex-1 flex flex-col" style={{ marginLeft: '420px' }}>
        <Header />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
