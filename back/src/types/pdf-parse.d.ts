declare module 'pdf-parse' {
    function pdfParse(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
    export default pdfParse;
}
