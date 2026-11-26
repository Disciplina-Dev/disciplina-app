// Safari n'implémente pas l'itération asynchrone des ReadableStream
// (`for await (const chunk of stream)`). pdf.js 6 s'en sert pour construire la
// couche texte (PDFPageProxy.getTextContent) : sans ce polyfill, afficher un PDF
// fait planter la page avec « undefined is not a function (near '...e of t...') ».
// Le build legacy de pdf.js ne le polyfille pas non plus.
if (typeof ReadableStream !== 'undefined' && !(Symbol.asyncIterator in ReadableStream.prototype)) {
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    async *value(this: ReadableStream) {
      const reader = this.getReader()
      let done = false
      try {
        while (true) {
          const result = await reader.read()
          if (result.done) {
            done = true
            return
          }
          yield result.value
        }
      } finally {
        // Sortie anticipée (break/throw) : annule le flux comme l'implémentation native.
        if (!done) await reader.cancel()
        reader.releaseLock()
      }
    },
  })
}
