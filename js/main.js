// Declarar variables de vistas y estado en un ámbito accesible
const formContainer = document.getElementById('formContainer');
const loadingContainer = document.getElementById('loadingContainer');
const confirmationContainer = document.getElementById('confirmationContainer');
const form = document.getElementById('reclamacionForm');
const viewPdfButton = document.getElementById('viewPdfButton');

let formFields;
let generatedPdfBlobUrl = null; 
let generatedPdfFileName = "Reclamacion.pdf"; 

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
    let fechaStr = "00-00-00";
    if(data.fecha) {
        const parts = data.fecha.split('-'); 
        if(parts.length === 3) {
            fechaStr = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
        }
    }
    const empresaLimpia = (data.empresa || '').replace(/[^a-zA-Z0-9]/g, '');
    const facturaStr = (data.factura || '').replace(/[^a-zA-Z0-9]/g, '');
    generatedPdfFileName = `Garantia-${empresaLimpia}-${facturaStr}-${fechaStr}.pdf`;
    // -------------------------------------

    try {
        const images = await getImagesAsBase64();
        const pdfBlob = await generatePdfBlob(data, images, generatedPdfFileName);
        generatedPdfBlobUrl = URL.createObjectURL(pdfBlob); 

        // Configurar el enlace de correo
        const mailtoLink = document.getElementById('mailtoLink');
        const subject = `Nueva Reclamación de: ${data.empresa} - Factura: ${data.factura || 'N/A'}`;
        const body = `Hola,\n\nHas recibido una nueva reclamación de la empresa: ${data.empresa}.\nPersona de contacto: ${data.contacto}.\n\nTodos los detalles y las imágenes están en el archivo PDF adjunto (${generatedPdfFileName}).\n\nSaludos.`;
        mailtoLink.href = `mailto:nacho@representacionesarroyo.es,paloma@representacionesarroyo.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        loadingContainer.style.display = 'none';
        confirmationContainer.style.display = 'block';

    } catch (error) {
        alert(error.message || 'Hubo un problema al generar el PDF.');
        console.error(error);
        loadingContainer.style.display = 'none';
        formContainer.style.display = 'block';
    }
});

// Event listener para el botón "Ver y Guardar PDF"
viewPdfButton.addEventListener('click', () => {
    if (generatedPdfBlobUrl) {
        const link = document.createElement('a');
        link.href = generatedPdfBlobUrl;
        link.download = generatedPdfFileName; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
    // Configuración inicial
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setProperties({ title: fileName });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 12; // Margen lateral similar a la imagen

    // Colores
    const headerBgColor = [253, 248, 235]; // Crema/Beige claro para cabecera
    const labelBgColor = [230, 230, 230];  // Gris claro para etiquetas
    const redColor = [255, 0, 0];          // Rojo U-Power

    // --- 1. CABECERA ---
    // Fondo crema
    doc.setFillColor(...headerBgColor);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Logos U-Power (Izquierda y Derecha)
    try {
        const logo = await imageToBase64('img/upower.png');
        // Logo Izquierdo
        doc.addImage(logo, 'PNG', margin, 8, 30, 12);
        // Logo Derecho
        doc.addImage(logo, 'PNG', pageWidth - margin - 30, 8, 30, 12);
    } catch (e) {
        console.warn("No se pudo cargar el logo:", e);
    }

    // Título Rojo Centrado
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...redColor);
    doc.text('RECLAMACION DE GARANTÍAS', pageWidth / 2, 18, { align: 'center' });

    // Línea separadora debajo de la cabecera
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);


    // --- 2. CAMPOS DE DATOS ---
    // Configuración de la rejilla
    let y = 45;
    const colGap = 10;
    const contentWidth = pageWidth - (margin * 2);
    const colWidth = (contentWidth - colGap) / 2; // Ancho de cada "columna" visual
    
    // Dimensiones celdas
    const rowHeight = 8;
    const labelWidth = 25; // Ancho de la etiqueta "FECHA", "CLIENTE", etc.
    const valueWidth = colWidth - labelWidth;

    // Función auxiliar para dibujar una fila estilo tabla
    const drawRow = (label, value, xStart, yPos) => {
        // Recuadro Etiqueta (Fondo Gris)
        doc.setFillColor(...labelBgColor);
        doc.rect(xStart, yPos, labelWidth, rowHeight, 'FD'); // Fill + Draw border
        
        // Texto Etiqueta
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(label, xStart + 2, yPos + 5.5);

        // Recuadro Valor (Fondo Blanco)
        doc.setFillColor(255, 255, 255);
        doc.rect(xStart + labelWidth, yPos, valueWidth, rowHeight, 'FD');

        // Texto Valor
        doc.setFont('Helvetica', 'normal');
        doc.text(String(value || '').toUpperCase(), xStart + labelWidth + 2, yPos + 5.5);
    };

    // Coordenadas X
    const leftColX = margin;
    const rightColX = margin + colWidth + colGap;

    // -- PRIMERA SECCIÓN (Arriba) --
    // Fila 1: FECHA (Izq) | AGENTE (Der)
    drawRow('FECHA', data.fecha, leftColX, y);
    drawRow('AGENTE', 'Representaciones Arroyo', rightColX, y);
    y += rowHeight + 2; // Espacio vertical pequeño

    // Fila 2: CLIENTE (Izq) | CONTACTO (Der)
    drawRow('CLIENTE', data.empresa, leftColX, y);
    drawRow('CONTACTO', data.contacto, rightColX, y);
    
    y += rowHeight + 8; // Salto más grande para separar secciones

    // -- SEGUNDA SECCIÓN --
    // Izquierda: MODELO, REF, TALLA
    // Derecha: DESCRIPCIÓN DEL DEFECTO (Caja grande)

    const startYSection2 = y;
    
    // Columna Izquierda
    drawRow('MODELO', data.modelo, leftColX, y);
    y += rowHeight + 2;
    drawRow('REF', data.referencia, leftColX, y);
    y += rowHeight + 2;
    drawRow('TALLA', data.talla, leftColX, y);

    // Columna Derecha (Caja de descripción)
    // Título
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DESCRIPCIÓN DEFECTO', rightColX, startYSection2 - 1); // Un poco encima de la caja
    
    // Caja grande (blanca con borde negro)
    const descBoxHeight = (rowHeight * 3) + 4; // Altura equivalente a las 3 filas de la izquierda
    doc.setDrawColor(0);
    doc.setFillColor(255, 255, 255);
    doc.rect(rightColX, startYSection2, colWidth, descBoxHeight, 'S'); // 'S' para solo Stroke (borde)
    
    // Texto descripción con auto-ajuste
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const splitDesc = doc.splitTextToSize(data.defecto, colWidth - 4);
    doc.text(splitDesc, rightColX + 2, startYSection2 + 5);

    y = startYSection2 + descBoxHeight + 10; // Mover Y debajo de todo

    // --- 3. SECCIÓN FOTOGRAFÍAS ---
    
    // Marco exterior grande
    const photoBoxHeight = 160; // Altura fija grande para las fotos
    const photoBoxY = y;
    
    // Título centrado en el borde superior del recuadro
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(100, 100, 100); // Color gris oscuro para el texto
    doc.text('INSERTAR FOTOGRAFÍAS', pageWidth / 2, photoBoxY - 3, { align: 'center' });

    // El borde grande del contenedor
    doc.setLineWidth(0.5);
    doc.rect(margin, photoBoxY, contentWidth, photoBoxHeight, 'S');

    // Cálculos para la cuadrícula de fotos (2x2)
    // Dejamos un padding interno
    const pPad = 5;
    const gridW = (contentWidth - (pPad * 3)) / 2;
    const gridH = (photoBoxHeight - (pPad * 3)) / 2;

    // Coordenadas cuadrícula
    const x1 = margin + pPad;
    const x2 = margin + pPad + gridW + pPad;
    const y1 = photoBoxY + pPad;
    const y2 = photoBoxY + pPad + gridH + pPad;

    // Insertar imágenes (ajustando a cover/contain básico)
    if (images.delantera) doc.addImage(images.delantera, 'JPEG', x1, y1, gridW, gridH, undefined, 'FAST');
    if (images.etiqueta) doc.addImage(images.etiqueta, 'JPEG', x2, y1, gridW, gridH, undefined, 'FAST');
    if (images.detalle) doc.addImage(images.detalle, 'JPEG', x1, y2, gridW, gridH, undefined, 'FAST');
    if (images.trasera) doc.addImage(images.trasera, 'JPEG', x2, y2, gridW, gridH, undefined, 'FAST');

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
            .catch(reject);
    });
}
