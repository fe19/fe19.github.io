const button = document.getElementById('button-generate');   // TODO rename id to buttonGenerate
const textFieldGeneration = document.getElementById('text-field-generation-description');


function drawDesign(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#0dcaf0';
    ctx.fillRect(50, 50, 300, 300);
}

function toggleVisibility(divId) {
    const div = document.getElementById(divId);
    if(div.style.display === "none" || div.style.display === "") {
        div.style.display = "flex"; // show the div
    } else {
        div.style.display = "none"; // hide the div
    }
}

button.addEventListener('click', function () {
    const canvasDesign = document.getElementById('canvasDesign');

    const length = document.getElementById('input-design-length').value;
    const width = document.getElementById('input-design-width').value;
    const height = document.getElementById('input-design-height').value;
    const floors = document.getElementById('input-design-floors').value;
    textFieldGeneration.textContent = `Generated a design with ground area ${length} x ${width} and ${floors} floors.`;

    // drawDesign(canvasDesign);
    //toggleVisibility("canvasContainer");
    toggleVisibility("text-field-generation-description");
    toggleVisibility("image3D");
})

// Experimental
// var bsButton = new bootstrap.Button(button)
// bsButton.toggle()
