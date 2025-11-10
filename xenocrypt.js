// --- Global Constants ---
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const SPANISH_QUOTES = [
    "SIEMPRE ES MAS FACIL DESTRUIR QUE CONSTRUIR.",
    "LA LIBERTAD ES EL DERECHO QUE TIENEN LAS PERSONAS PARA ACTUAR SIN SER ESCLAVIZADOS.",
    "LA MUSICA EXPRESA LO QUE NO PUEDE SER DICHO Y AQUELLO SOBRE LO QUE ES IMPOSIBLE PERMANECER EN SILENCIO.",
    "AÑOS DE LUCHA POR UN MAÑANA MEJOR.",
    "EL VIAJE DE MIL MILLAS COMIENZA CON UN SOLO PASO.",
    "GRACIAS POR SU ATENCION. ESPERO QUE FUNCIONE."
];

// --- Global State ---
let currentCiphertext = '';
let currentPlaintext = '';     // The original, normalized Spanish quote
let substitutionMap = {};      // User guesses: { 'CipherLetter': 'PlainLetter' }
let correctKey = {};           // Solution key: { 'CipherLetter': 'PlainLetter' }
let frequencyMap = {};         // Frequencies: { 'A': 15, 'B': 2, ... }

// --- Elements ---
const puzzleGridDisplay = document.getElementById('cipher-display');
const clearButton = document.getElementById('clear-button');
const newPuzzleButton = document.getElementById('new-puzzle-btn');
const giveUpButton = document.getElementById('give-up-button');
const mappingGrid = document.getElementById('mapping-grid');
const messageArea = document.getElementById('message-area');
const statusMessage = document.getElementById('status-message');


// --- Utility Functions ---

/**
 * Normalizes the Spanish text according to SO rules:
 * 1. Convert to uppercase.
 * 2. Remove all accents (Á -> A, É -> E, etc.).
 * 3. The character Ñ is preserved as-is and is NOT substituted.
 */
function normalizeSpanish(text) {
    let normalized = text.toUpperCase();
    
    // Replace accented vowels with their unaccented equivalents
    normalized = normalized.replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
    
    return normalized;
}

/**
 * Calculates the frequency of each substitution letter (A-Z only) in the current ciphertext.
 */
function calculateFrequency() {
    const counts = {};

    ALPHABET.split('').forEach(char => counts[char] = 0); // Initialize all to 0

    currentCiphertext.toUpperCase().split('').forEach(char => {
        // Only count standard English letters for substitution frequency
        if (ALPHABET.includes(char)) {
            counts[char]++;
        }
    });

    frequencyMap = counts;
}

/**
 * Shuffles the letters of the alphabet to create a substitution key (derangement).
 * @returns {Object} A substitution map { CipherLetter: PlainLetter }
 */
function generateRandomKey() {
    const plainSource = ALPHABET.split('');
    let cipherTarget = [...ALPHABET].sort(() => Math.random() - 0.5);

    // Ensure the key is a Derangement (no letter maps to itself: C -> C)
    let hasFixedPoints = true;
    while(hasFixedPoints) {
        hasFixedPoints = false;
        
        for (let i = 0; i < ALPHABET.length; i++) {
            if (plainSource[i] === cipherTarget[i]) {
                hasFixedPoints = true;
                let j = (i + 1) % ALPHABET.length;
                [cipherTarget[i], cipherTarget[j]] = [cipherTarget[j], cipherTarget[i]];
                break; 
            }
        }
    }
    
    // Create the INVERSE key: { PlainLetter: CipherLetter }
    const inverseKey = {};
    for(let i = 0; i < 26; i++) {
        inverseKey[plainSource[i]] = cipherTarget[i];
    }
    return inverseKey; // Returns Plain -> Cipher
}

/**
 * Encrypts a message and establishes the final key.
 * @param {string} plaintext - The normalized plaintext message.
 * @param {Object} inverseKey - The substitution map { PlainLetter: CipherLetter }.
 * @returns {string} The ciphertext.
 */
function encryptMessage(plaintext, inverseKey) {
    // 1. Encrypt the quote
    const ciphertext = plaintext.split('').map(char => {
        // Only substitute English letters A-Z
        if (ALPHABET.includes(char)) {
            return inverseKey[char] || char;
        }
        // Pass through all other characters (Ñ, punctuation, spaces, etc.)
        return char;
    }).join('');

    // 2. Derive the correctKey (Cipher -> Plain) for solution checking
    const solutionKey = {};
    for (const [plain, cipher] of Object.entries(inverseKey)) {
        solutionKey[cipher] = plain;
    }
    
    // Store the solution key globally
    correctKey = solutionKey;

    return ciphertext;
}

// --- Core Logic ---

/**
 * Handles the input event when a user types into a plaintext box.
 * This function updates the substitution map and manages letter conflicts.
 */
function handlePlainTextInput(event, cipherChar) {
    const input = event.target;
    let plainChar = input.value.toUpperCase();

    // 1. Sanitize Input
    plainChar = plainChar.length > 1 ? plainChar.slice(-1) : plainChar;
    plainChar = plainChar.replace(/[^A-Z]/g, '');

    input.value = plainChar; 

    if (plainChar) {
        // 2. Check for conflicts (Plaintext used by a DIFFERENT Cipher letter)
        const conflictCipher = Object.keys(substitutionMap).find(
            (key) => substitutionMap[key] === plainChar && key !== cipherChar
        );

        if (conflictCipher) {
            // Remove the old mapping
            delete substitutionMap[conflictCipher];
            
            // Clear the input boxes for the conflicting letter
            const conflictInputs = document.querySelectorAll(`input[data-cipher-char="${conflictCipher}"]`);
            conflictInputs.forEach(cInput => cInput.value = '');

            messageArea.textContent = `Conflict resolved: ${conflictCipher} is no longer mapped to ${plainChar}.`;
            messageArea.style.color = 'orange';
        }

        // 3. Set the new mapping
        substitutionMap[cipherChar] = plainChar;

        // 4. Auto-advance logic: move focus to the next input box
        const allInputs = Array.from(document.querySelectorAll('.plaintext-input'));
        const currentIndex = allInputs.indexOf(input);
        
        let nextIndex = currentIndex + 1;
        if (nextIndex < allInputs.length) {
            allInputs[nextIndex].focus();
        }

    } else {
        // Input cleared
        delete substitutionMap[cipherChar];
    }
    
    // 5. Update ALL inputs corresponding to this cipherChar
    const inputsToUpdate = document.querySelectorAll(`input[data-cipher-char="${cipherChar}"]`);
    inputsToUpdate.forEach(i => {
        i.value = plainChar;
    });

    updateMappingTable();
    checkSolution();
}

/**
 * Initializes a new puzzle, setting up the key and ciphertext.
 */
function generateNewPuzzle() {
    // 1. Select a random quote from the loaded array
    const rawQuote = SPANISH_QUOTES[Math.floor(Math.random() * SPANISH_QUOTES.length)];
    currentPlaintext = normalizeSpanish(rawQuote);

    // 2. Generate the INVERSE key (Plain -> Cipher)
    const inverseKey = generateRandomKey(); 

    // 3. Encrypt the quote, which also sets the global correctKey (Cipher -> Plain)
    currentCiphertext = encryptMessage(currentPlaintext, inverseKey);

    // 4. Reset state
    substitutionMap = {};
    
    // 5. Calculate frequency
    calculateFrequency();
    
    // 6. Update the display
    renderPuzzleGrid();
    updateMappingTable();
    statusMessage.classList.add('hidden');
    messageArea.textContent = 'New Spanish Xenocrypt loaded! Start typing your guesses into the boxes.';
    messageArea.style.color = '#3b82f6'; // Blue
}


/**
 * Renders the full puzzle grid: Ciphertext letters stacked above Plaintext input boxes.
 */
function renderPuzzleGrid() {
    puzzleGridDisplay.innerHTML = ''; 
    
    currentCiphertext.split('').forEach(cipherChar => {
        const isCipherLetter = ALPHABET.includes(cipherChar);
        
        const charGroup = document.createElement('div');
        charGroup.classList.add('char-group');
        
        // 1. Cipher Character (Top)
        const cipherSpan = document.createElement('span');
        cipherSpan.textContent = cipherChar;
        cipherSpan.classList.add('cipher-char');
        charGroup.appendChild(cipherSpan);

        // 2. Plaintext Input or Placeholder (Bottom)
        if (isCipherLetter) {
            const plainInput = document.createElement('input');
            plainInput.type = 'text';
            plainInput.setAttribute('data-cipher-char', cipherChar); 
            plainInput.classList.add('plaintext-input');
            plainInput.maxLength = 1;
            
            plainInput.value = substitutionMap[cipherChar] || '';

            // Attach the handler that updates the map and all matching inputs
            plainInput.addEventListener('input', (e) => handlePlainTextInput(e, cipherChar));

            // Optional: Add basic movement listeners for smoother UX
            plainInput.addEventListener('keydown', (e) => {
                const allInputs = Array.from(document.querySelectorAll('.plaintext-input'));
                const currentIndex = allInputs.indexOf(e.target);
                
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    allInputs[currentIndex - 1].focus();
                } else if (e.key === 'ArrowRight' && currentIndex < allInputs.length - 1) {
                    e.preventDefault();
                    allInputs[currentIndex + 1].focus();
                } else if (e.key === 'Backspace' && e.target.value === '' && currentIndex > 0) {
                     e.preventDefault();
                     allInputs[currentIndex - 1].focus();
                }
            });

            charGroup.appendChild(plainInput);
            
        } else {
            // Non-substituted characters (space, punctuation, Ñ)
            const nonCipherSpan = document.createElement('span');
            nonCipherSpan.textContent = cipherChar === ' ' ? '\u00A0' : cipherChar; 
            nonCipherSpan.classList.add('non-cipher', 'font-sans', 'font-normal');
            charGroup.appendChild(nonCipherSpan);
        }

        puzzleGridDisplay.appendChild(charGroup);
    });
}


/**
 * Updates the display of current substitutions and frequency (Key Table) in a three-row format.
 */
function updateMappingTable() {
    mappingGrid.innerHTML = '';
    
    // Create three main row containers
    const freqRow = document.createElement('div');
    const cipherRow = document.createElement('div');
    const plainRow = document.createElement('div');

    freqRow.classList.add('mapping-row', 'frequency-row');
    cipherRow.classList.add('mapping-row', 'bg-white');
    plainRow.classList.add('mapping-row', 'bg-white');

    // 1. Frequency Row Label
    const freqLabel = document.createElement('div');
    freqLabel.classList.add('mapping-label');
    freqLabel.textContent = 'Count (A-Z):';
    freqRow.appendChild(freqLabel);
    
    // 2. Cipher Row Label
    const cipherLabel = document.createElement('div');
    cipherLabel.classList.add('mapping-label');
    cipherLabel.textContent = 'Cipher:';
    cipherRow.appendChild(cipherLabel);

    // 3. Plain Row Label
    const plainLabel = document.createElement('div');
    plainLabel.classList.add('mapping-label');
    plainLabel.textContent = 'Plain (Guess):';
    plainRow.appendChild(plainLabel);


    // Populate the three rows with data for each letter A-Z
    ALPHABET.split('').forEach(cipher => {
        // Frequency Row Item
        const freqItem = document.createElement('div');
        freqItem.classList.add('mapping-cell');
        freqItem.textContent = frequencyMap[cipher] || 0;
        freqRow.appendChild(freqItem);

        // Cipher Row Item
        const cipherItem = document.createElement('div');
        cipherItem.classList.add('mapping-cell', 'text-red-600');
        cipherItem.textContent = cipher;
        cipherRow.appendChild(cipherItem);

        // Plaintext Row Item (Guess)
        const plain = substitutionMap[cipher] || '_';
        const plainItem = document.createElement('div');
        plainItem.classList.add('mapping-cell', 'text-green-600');
        plainItem.textContent = plain;
        plainRow.appendChild(plainItem);
    });

    // Append the rows to the grid container
    mappingGrid.appendChild(freqRow);
    mappingGrid.appendChild(cipherRow);
    mappingGrid.appendChild(plainRow);
}


/**
 * Checks if the decoded text matches the original plaintext.
 */
function checkSolution() {
    let currentDecryptedText = currentCiphertext.split('').map(cipherChar => {
        if (ALPHABET.includes(cipherChar)) {
            return substitutionMap[cipherChar] || '_';
        }
        return cipherChar;
    }).join('');

    if (currentDecryptedText === currentPlaintext && currentPlaintext.length > 0) {
        statusMessage.classList.remove('hidden');
        messageArea.textContent = 'CONGRATULATIONS! Puzzle Solved!';
        messageArea.style.color = 'green';
    } else {
        statusMessage.classList.add('hidden');
        // Clear status message unless it's the conflict warning
        if (messageArea.textContent.includes('CONGRATULATIONS') || messageArea.textContent.includes('Conflict resolved')) {
            // Keep the messages
        } else {
             messageArea.textContent = '';
        }
    }
}

/**
 * Clears all current substitution mappings.
 */
function clearMappings() {
    substitutionMap = {};
    messageArea.textContent = 'All mappings cleared. Start over!';
    messageArea.style.color = '#f59e0b'; // Amber
    // Re-render the grid to clear all input boxes
    renderPuzzleGrid();
    updateMappingTable();
}

/**
 * Reveals the solution by copying the correct key to the substitution map.
 */
function giveUp() {
    if (!currentCiphertext) return;

    // Set the user's map to the correct solution
    substitutionMap = { ...correctKey }; 
    
    // Update all displays
    renderPuzzleGrid(); 
    updateMappingTable();
    
    messageArea.textContent = 'Solution Revealed! Click "Generate New Cipher" to try a new puzzle.';
    messageArea.style.color = '#dc3545'; // Red
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Attach listeners to buttons
    clearButton.addEventListener('click', clearMappings);
    newPuzzleButton.addEventListener('click', generateNewPuzzle);
    giveUpButton.addEventListener('click', giveUp); 
    
    // Generate the initial puzzle
    generateNewPuzzle();
});