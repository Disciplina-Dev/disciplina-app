export default function SelectProfil() {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Sélection du profil</h1>
      <div className="flex flex-col gap-4">
        <button
          onClick={handleGoogleLogin}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition font-medium"
        >
          Se connecter avec Google Drive
        </button>
      </div>
    </div>
  );
}
