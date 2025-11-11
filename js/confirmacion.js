document.addEventListener('DOMContentLoaded', () => {
    const viewPdfButton = document.getElementById('viewPdfButton');
    const mailtoLinkElement = document.getElementById('mailtoLink');
    const pdfErrorElement = document.getElementById('pdfError');

    // 1. Recuperar la cadena Base64 del PDF desde sessionStorage
    const pdfBase64 = sessionStorage.getItem('pdfData');

    if (pdfBase64) {
        viewPdfButton.style.display = 'inline-block';
        pdfErrorElement.style.display = 'none';

        viewPdfButton.addEventListener('click', (event) => {
            event.preventDefault();
            try {
                // Convertir la cadena Base64 de nuevo a un Blob
                const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');
                const blobUrl = URL.createObjectURL(pdfBlob);
                
                // Abrir el PDF en una nueva pestaña (esto funciona en iOS por ser un clic)
                window.open(blobUrl, '_blank');
            } catch (e) {
                console.error("Error al mostrar el PDF:", e);
                alert("No se pudo mostrar el PDF. Inténtalo de nuevo.");
            }
        });
    } else {
        viewPdfButton.style.display = 'none';
        pdfErrorElement.style.display = 'block';
    }

    // Configurar el enlace de correo con los parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const subject = params.get('subject');
    const body = params.get('body');
    const recipient = 'nacho@representacionesarroyo.com';

    if (subject && body) {
        mailtoLinkElement.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    } else {
        mailtoLinkElement.href = `mailto:${recipient}`;
    }
});

// Función auxiliar para convertir una cadena Base64 a un Blob
function base64ToBlob(base64, contentType = '', sliceSize = 512) {
    // Extraer los datos puros de la cadena Base64
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}