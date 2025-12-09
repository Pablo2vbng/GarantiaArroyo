// Declarar variables de vistas y estado en un ámbito accesible
const formContainer = document.getElementById('formContainer');
const loadingContainer = document.getElementById('loadingContainer');
const confirmationContainer = document.getElementById('confirmationContainer');
const form = document.getElementById('reclamacionForm');
const viewPdfButton = document.getElementById('viewPdfButton');

let formFields;
let generatedPdfBlobUrl = null; // Guardaremos la URL del PDF aquí
let generatedPdfFileName = "Reclamacion.pdf"; // Variable para guardar el nombre personalizado

document.addEventListener('DOMContentLoaded', () => {
    // Asignar formFields una vez que el DOM está listo
    formFields = form.querySelectorAll('input[type="text"], input[type="date"], input[type="tel"], textarea');

    // Lógica para guardar y cargar datos del formulario en localStorage
    const saveData = () => formFields.forEach(field => localStorage.setItem(field.id, field.value));
    const loadData = () => {
        formFields.forEach(field => {
            const savedValue = localStorage.getItem(field.id);
            if (savedValue) field.value = savedValue;
        });
    };
    formFields.forEach(field => field.addEventListener('input', saveData));
    loadData();

    // Lógica para mostrar feedback de subida de archivos
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const successMessage = event.target.closest('.input-ejemplo').querySelector('.upload-success-message');
            successMessage.style.display = event.target.files.length > 0 ? 'inline' : 'none';
        });
    });

    // Botón para crear una nueva reclamación
    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        formFields.forEach(field => localStorage.removeItem(field.id));
        window.location.reload();
    });
});

// Event listener para el envío del formulario
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Cambiar a la vista de "Cargando"
    formContainer.style.display = 'none';
    loadingContainer.style.display = 'block';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // --- LÓGICA DE NOMBRE DEL ARCHIVO ---
    // 1. Formatear la fecha (de YYYY-MM-DD a DD-MM-YY)
    let fechaStr = "00-00-00";
    if(data.fecha) {
        const parts = data.fecha.split('-'); // [2025, 12, 09]
        if(parts.length === 3) {
            fechaStr = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
        }
    }

    // 2. Limpiar nombre empresa (Quitar espacios y caracteres raros para el nombre del archivo)
    // Ejemplo: "Alisan mascotas" -> "Alisanmascotas"
    const empresaLimpia = (data.empresa || '').replace(/[^a-zA-Z0-9]/g, '');

    // 3. Obtener factura
    const facturaStr = (data.factura || '').replace(/[^a-zA-Z0-9]/g, '');

    // 4. Construir el nombre final: Garantia-Empresa-Factura-Fecha.pdf
    generatedPdfFileName = `Garantia-${empresaLimpia}-${facturaStr}-${fechaStr}.pdf`;
    // -------------------------------------

    try {
        const images = await getImagesAsBase64();
        // Pasamos el nombre del archivo a la función generadora para los metadatos
        const pdfBlob = await generatePdfBlob(data, images, generatedPdfFileName);
        generatedPdfBlobUrl = URL.createObjectURL(pdfBlob); // Guardar la URL del blob

        // Configurar el enlace de correo
        const mailtoLink = document.getElementById('mailtoLink');
        const subject = `Nueva Reclamación de: ${data.empresa} - Factura: ${data.factura || 'N/A'}`;
        const body = `Hola,\n\nHas recibido una nueva reclamación de la empresa: ${data.empresa}.\nPersona de contacto: ${data.contacto}.\n\nTodos los detalles y las imágenes están en el archivo PDF adjunto (${generatedPdfFileName}).\n\nSaludos.`;
        mailtoLink.href = `mailto:nacho@representacionesarroyo.es,paloma@representacionesarroyo.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Cambiar a la vista de "Confirmación"
        loadingContainer.style.display = 'none';
        confirmationContainer.style.display = 'block';

    } catch (error) {
        alert(error.message || 'Hubo un problema al generar el PDF.');
        console.error(error);
        // Volver a la vista del formulario si hay un error
        loadingContainer.style.display = 'none';
        formContainer.style.display = 'block';
    }
});

// Event listener para el botón "Ver y Guardar PDF"
viewPdfButton.addEventListener('click', () => {
    if (generatedPdfBlobUrl) {
        // Opción A: Intentar forzar la descarga con nombre correcto
        // Esto funciona mejor para mantener el nombre del archivo
        const link = document.createElement('a');
        link.href = generatedPdfBlobUrl;
        link.download = generatedPdfFileName; // Aquí se aplica el nombre personalizado
        document.body.appendChild(link);
        
        // En móviles a veces es necesario abrir en nueva pestaña si la descarga falla,
        // pero 'download' es la única forma estándar de poner nombre.
        link.click();
        
        document.body.removeChild(link);

        // Fallback visual para móviles (opcional): Abrir también en pestaña nueva
        // si el click anterior no fue suficiente (algunos navegadores iOS bloquean descargas directas sin visualización)
        // setTimeout(() => {
        //     window.open(generatedPdfBlobUrl, '_blank');
        // }, 500);

        // Limpiar localStorage DESPUÉS de que el usuario haya interactuado
        formFields.forEach(field => localStorage.removeItem(field.id));
    } else {
        alert("Error: No se ha generado ningún PDF.");
    }
});

// --- FUNCIONES AUXILIARES ---

function getImagesAsBase64() {
    const fileInputs = [
        document.getElementById('fotoDelantera'), document.getElementById('fotoTrasera'),
        document.getElementById('fotoDetalleDefecto'), document.getElementById('fotoEtiqueta')
    ];
    const filePromises = fileInputs.map(input => {
        return new Promise((resolve, reject) => {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(input.files[0]);
            } else {
                reject(new Error(`La imagen "${input.labels[0].textContent}" es obligatoria.`));
            }
        });
    });
    return Promise.all(filePromises).then(([delantera, trasera, detalle, etiqueta]) => ({ delantera, trasera, detalle, etiqueta }));
}

async function generatePdfBlob(data, images, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // AÑADIR METADATOS AL PDF (Título interno)
    doc.setProperties({
        title: fileName
    });

    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);

    try {
        const upowerLogoBase64 = await imageToBase64('img/upower.png');
        doc.addImage(upowerLogoBase64, 'PNG', margin, 5, 25, 10);
    } catch (logoError) {
        console.warn('Logo de U-Power no encontrado:', logoError);
    }

    doc.setFontSize(14).setFont('Helvetica', 'bold').setTextColor(255, 0, 0);
    doc.text('RECLAMACION DE GARANTÍAS', pageWidth / 2, 10, { align: 'center' });
    doc.setDrawColor(0, 0, 0).setLineWidth(0.5).line(margin, 15, pageWidth - margin, 15);

    let y = 20;
    const fieldHeight = 8, labelWidth = 30, dataWidth = 60;
    const col1X = margin, col2X = margin + labelWidth + dataWidth + 10;

    const drawField = (label, value, x, yPos) => {
        doc.setFontSize(9).setFont('Helvetica', 'bold').setFillColor(230, 230, 230);
        doc.rect(x, yPos, labelWidth, fieldHeight, 'FD');
        doc.setTextColor(0, 0, 0).text(label, x + 2, yPos + 5);
        doc.rect(x + labelWidth, yPos, dataWidth, fieldHeight, 'S');
        doc.setFont('Helvetica', 'normal').text(value || '', x + labelWidth + 2, yPos + 5);
    };

    drawField('FECHA', data.fecha, col1X, y);
    drawField('AGENTE', 'Representaciones Arroyo', col2X, y); y += fieldHeight;
    drawField('CLIENTE', data.empresa, col1X, y);
    drawField('CONTACTO', data.contacto, col2X, y); y += fieldHeight;
    drawField('MODELO', data.modelo, col1X, y); y += fieldHeight;
    drawField('REF', data.referencia, col1X, y); y += fieldHeight;
    drawField('TALLA', data.talla, col1X, y); y += fieldHeight + 5;

    doc.setFontSize(9).setFont('Helvetica', 'bold').text('DESCRIPCIÓN DEFECTO', col1X, y); y += 3;
    const descHeight = 30;
    doc.rect(col1X, y, contentWidth, descHeight, 'S');
    const splitDescription = doc.splitTextToSize(data.defecto, contentWidth - 4);
    doc.setFont('Helvetica', 'normal').text(splitDescription, col1X + 2, y + 5);
    y += descHeight + 5;

    const photoAreaHeight = doc.internal.pageSize.getHeight() - y - margin;
    doc.setFillColor(245, 245, 245).rect(margin, y, contentWidth, photoAreaHeight, 'F');
    const photoMargin = 5;
    const photoGridWidth = (contentWidth - photoMargin) / 2;
    const photoGridHeight = (photoAreaHeight - photoMargin) / 2;

    if (images.delantera) doc.addImage(images.delantera, 'JPEG', col1X, y, photoGridWidth, photoGridHeight);
    if (images.trasera) doc.addImage(images.trasera, 'JPEG', col1X + photoGridWidth + photoMargin, y, photoGridWidth, photoGridHeight);
    if (images.detalle) doc.addImage(images.detalle, 'JPEG', col1X, y + photoGridHeight + photoMargin, photoGridWidth, photoGridHeight);
    if (images.etiqueta) doc.addImage(images.etiqueta, 'JPEG', col1X + photoGridWidth + photoMargin, y + photoGridHeight + photoMargin, photoGridWidth, photoGridHeight);

    return doc.output('blob');
}

function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
}
