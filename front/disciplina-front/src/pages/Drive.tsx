import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Drive() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:4000/api/files', { credentials: 'include' })
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
    fetch('http://localhost:4000/api/logout', { credentials: 'include' })
      .then(() => {
        navigate('/');
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mes Fichiers Drive</h1>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition font-medium"
          >
            Déconnexion
          </button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement des fichiers...</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {files.map((file) => (
                <li key={file.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{file.mimeType}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                  </div>
                </li>
              ))}
              {files.length === 0 && !loading && (
                <li className="p-8 text-center text-gray-500">Aucun fichier trouvé.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
