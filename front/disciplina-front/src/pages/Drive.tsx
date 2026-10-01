import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Drive() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/files`, { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          navigate('/');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        setFiles(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [navigate]);

  const handleLogout = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/logout`, { credentials: 'include' })
      .then(() => {
        navigate('/');
      });
  };

  return (
    <div className="min-h-screen bg-[var(--ds-surface-sunken)] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--ds-text)]">Mes Fichiers Drive</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[var(--ds-danger)] text-white rounded-lg shadow hover:bg-red-700 transition font-medium"
          >
            Déconnexion
          </button>
        </div>

        <div className="bg-[var(--ds-surface)] rounded-xl shadow-sm overflow-hidden border border-[var(--ds-border)]">
          {loading ? (
            <div className="p-8 text-center text-[var(--ds-text-subtle)]">Chargement des fichiers...</div>
          ) : (
            <ul className="divide-y divide-[var(--ds-border)]">
              {files.map((file) => (
                <li key={file.id} className="p-4 hover:bg-[var(--ds-surface-sunken)] flex justify-between items-center transition">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-[var(--ds-text)]">{file.name}</p>
                      <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">{file.mimeType}</p>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--ds-text-subtle)] bg-[var(--ds-surface-sunken)] px-3 py-1 rounded-full">
                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                  </div>
                </li>
              ))}
              {files.length === 0 && !loading && (
                <li className="p-8 text-center text-[var(--ds-text-subtle)]">Aucun fichier trouvé.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
