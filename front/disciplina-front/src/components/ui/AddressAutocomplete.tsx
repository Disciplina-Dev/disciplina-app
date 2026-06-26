import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';

interface AddressAutocompleteProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  apiEndpoint: string;
  placeholder?: string;
}

export function AddressAutocomplete({ label, id, value, onChange, apiEndpoint, placeholder }: AddressAutocompleteProps) {
  const token = useAuthStore((s) => s.token);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!v.trim() || !token) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ input: v });
        const url = `${import.meta.env.VITE_API_URL}${apiEndpoint}?${params}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json() as { status: string; results: string[] };
        if (data.status === 'OK' && data.results.length > 0) {
          setSuggestions(data.results);
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 relative">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-[10px] border border-gray-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 transition-colors"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-auto rounded-xl border border-gray-100 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={() => handleSelect(s)}
              className="cursor-pointer px-4 py-2.5 text-sm text-gray-800 hover:bg-blue-50 hover:text-blue"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
