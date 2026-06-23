interface GeocodageResultRaw {
    fulltext: string;
    x: number;
    y: number;
    type?: string;
    city?: string;
    zipcode?: string;
    street?: string;
}

interface GeocodageResponseRaw {
    status: string;
    results: GeocodageResultRaw[];
}

export class GeocodageService {
    private API_BASE_URI = 'https://data.geopf.fr/geocodage/completion';

    async search(address: string): Promise<string[] | null> {
        const params = new URLSearchParams({ text: address.trim() });
        const url = `${this.API_BASE_URI}?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { accept: 'application/json' },
            });

            if (!response.ok) return null;

            const data: GeocodageResponseRaw = await response.json();

            if (data.status !== 'OK') return null;

            return data.results.map((r) => r.fulltext);
        } catch {
            return null;
        }
    }
}
