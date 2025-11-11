// script.js

// --- Global State ---
let currentCiphertext = '';
let currentPlaintext = ''; // The original quote used to generate the cipher
let substitutionMap = {};  // Stores current user guesses: { 'CipherLetter': 'PlainLetter' }
let correctKey = {};       // Stores the correct mapping: { 'CipherLetter': 'PlainLetter' }
let loadedPuzzles = [];    // Will store the quotes fetched from puzzles.json
let frequencyMap = {};     // NEW: Stores letter frequencies: { 'A': 15, 'B': 2, ... }

// --- Elements ---
const puzzleGridDisplay = document.getElementById('puzzle-grid-display'); // New element ID
const clearButton = document.getElementById('clear-button');
const newPuzzleButton = document.getElementById('new-puzzle-button');
const giveUpButton = document.getElementById('give-up-button'); // New button element
const mappingGrid = document.getElementById('mapping-grid');
const messageArea = document.getElementById('message-area');

const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

// --- Utility Functions ---

/**
 * Loads the list of puzzles from the external JSON file.
 */
async function loadPuzzles() {
    try {
        messageArea.textContent = 'Loading puzzles...';
        // Use fetch to get the JSON file
        const response = await fetch('spanish_quotes.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Parse the JSON data into the loadedPuzzles array
        loadedPuzzles = await response.json();
        
        messageArea.textContent = 'Puzzles loaded successfully! Click "Generate New Cipher" to start!';
        messageArea.style.color = 'green';

    } catch (error) {
        console.error("Could not load puzzles:", error);
        messageArea.textContent = 'ERROR: Could not load puzzles. Check console for details.';
        messageArea.style.color = 'red';
        // Disable buttons if loading fails
        newPuzzleButton.disabled = true;
        clearButton.disabled = true;
    }
}

/**
 * Calculates the frequency of each letter in the current ciphertext.
 */
function calculateFrequency() {
    const counts = {};

    ALPHABET.split('').forEach(char => counts[char] = 0); // Initialize all to 0

    currentCiphertext.toUpperCase().split('').forEach(char => {
        if (ALPHABET.includes(char)) {
            counts[char]++;
        }
    });

    frequencyMap = counts;
}

/**
 * Shuffles the letters of the alphabet to create a substitution key,
 * ensuring it is a DERANGEMENT (no letter maps to itself: C -> C).
 * @returns {Object} A substitution map { CipherLetter: PlainLetter }
 */
function generateRandomKey() {
    const cipherSource = ALPHABET.split('');
    // Start with a random shuffle
    let plainTarget = [...ALPHABET].sort(() => Math.random() - 0.5);
    
    // Ensure the key is a Derangement (no letter maps to itself: C -> C)
    let hasFixedPoints = true;
    while(hasFixedPoints) {
        hasFixedPoints = false;
        
        for (let i = 0; i < ALPHABET.length; i++) {
            // Check for a fixed point (Cipher 'A' maps to Plain 'A')
            if (cipherSource[i] === plainTarget[i]) {
                hasFixedPoints = true;
                
                // Find a simple swap: swap with the next letter to break the fixed point
                let j = (i + 1) % ALPHABET.length;
                
                // Perform the swap
                [plainTarget[i], plainTarget[j]] = [plainTarget[j], plainTarget[i]];
                
                // After the swap, we break and check the whole array again in the next while loop iteration
                break; 
            }
        }
    }
    
    // Now convert the derangement array back into the map
    const keyMap = {};
    for(let i = 0; i < 27; i++) {
        // keyMap will look like: { 'A': 'Q', 'B': 'Z', ... }
        keyMap[cipherSource[i]] = plainTarget[i];
    }
    return keyMap;
}

/**
 * Encrypts a message using the solution key by inverting it.
 * @param {string} text - The plaintext message.
 * @param {Object} key - The substitution map { CipherLetter: PlainLetter }.
 * @returns {string} The ciphertext.
 */
function encryptMessage(text, key) {
    // We need the reverse mapping (Plain -> Cipher) to encrypt
    const inverseKey = {};
    for (const [cipher, plain] of Object.entries(key)) {
        inverseKey[plain] = cipher;
    }

    return text.toUpperCase().split('').map(char => {
        // Check if the character is a letter
        if (ALPHABET.includes(char)) {
            // Use the inverse key for encryption
            return inverseKey[char] || char; 
        }
        // Keep spaces and punctuation as is
        return char;
    }).join('');
}


// --- Core Logic ---

/**
 * Handles the input event when a user types into a plaintext box.
 * This function updates the substitution map and manages letter conflicts.
 * @param {Event} event - The input event.
 * @param {string} cipherChar - The ciphertext letter corresponding to this input box.
 */
function handlePlainTextInput(event, cipherChar) {
    let plainChar = event.target.value.toUpperCase();

    // 1. Keep input to a single, valid letter
    if (plainChar.length > 1) {
        plainChar = plainChar.slice(-1); // Take only the last character entered
    }

    if (plainChar && !ALPHABET.includes(plainChar)) {
        // If the character is not a letter, clear the input
        event.target.value = '';
        plainChar = ''; // Treat as cleared
    }

    event.target.value = plainChar; // Ensure the input is uppercase

    let conflictCipher = null;

    if (plainChar) {
        // 2. Check for conflicts: if the Plaintext letter is already used by a DIFFERENT Cipher letter
        conflictCipher = Object.keys(substitutionMap).find(
            (key) => substitutionMap[key] === plainChar && key !== cipherChar
        );

        if (conflictCipher) {
            // 2a. Remove the old mapping
            delete substitutionMap[conflictCipher];
            
            // 2b. Clear the input boxes for the conflicting letter across the entire grid
            const conflictInputs = document.querySelectorAll(`input[data-cipher-char="${conflictCipher}"]`);
            conflictInputs.forEach(input => {
                input.value = '';
            });

            // Provide feedback on the conflict
            messageArea.textContent = `Conflict resolved: ${conflictCipher} is no longer mapped.`;
            messageArea.style.color = 'orange';
        }

        // 3. Set the new mapping
        substitutionMap[cipherChar] = plainChar;

        // 4. Auto-advance logic: move focus to the next input box
        const allInputs = Array.from(document.querySelectorAll('.plain-input'));
        const currentIndex = allInputs.indexOf(event.target);
        
        // Find the index of the next non-space/punctuation input box
        let nextIndex = currentIndex + 1;
        let nextInput = null;

        while (nextIndex < allInputs.length) {
            nextInput = allInputs[nextIndex];
            // Check if the next element is a standard input box
            if (nextInput && nextInput.tagName === 'INPUT') {
                nextInput.focus();
                break;
            }
            nextIndex++;
        }

    } else {
        // If the input was cleared (backspace/delete)
        delete substitutionMap[cipherChar];
    }
    
    // 5. Update ALL inputs corresponding to this cipherChar
    const inputsToUpdate = document.querySelectorAll(`input[data-cipher-char="${cipherChar}"]`);
    inputsToUpdate.forEach(input => {
        // Only update if the input is not the one currently being typed into (to avoid loop/focus issues)
        if (input !== event.target) {
            input.value = plainChar;
        }
    });

    updateMappingTable();
    checkSolution();
}


/**
 * Initializes a new puzzle, setting up the key and ciphertext.
 */
function generateNewPuzzle() {
    if (loadedPuzzles.length === 0) {
        messageArea.textContent = 'Puzzles not loaded. Check console for fetch errors.';
        return;
    }
    
    // 1. Select a random quote from the loaded array
    const rawQuote = loadedPuzzles[Math.floor(Math.random() * loadedPuzzles.length)];
    currentPlaintext = rawQuote.toUpperCase();

    // 2. Generate the CORRECT key and store it globally
    correctKey = generateRandomKey(); // { CipherLetter: PlainLetter }

    // 3. Encrypt the quote using the correct key 
    currentCiphertext = encryptMessage(rawQuote, correctKey);

    // 4. Reset state
    substitutionMap = {};
    
    // 5. Calculate frequency
    calculateFrequency();
    
    // 6. Update the display
    renderPuzzleGrid();
    updateMappingTable();
    messageArea.textContent = 'New puzzle loaded! Start typing your guesses into the boxes.';
    messageArea.style.color = 'green';
}

/**
 * Renders the full puzzle grid: Ciphertext letters stacked above Plaintext input boxes.
 */
function renderPuzzleGrid() {
    puzzleGridDisplay.innerHTML = ''; // Clear previous content
    
    currentCiphertext.split('').forEach(cipherChar => {
        if (ALPHABET.includes(cipherChar)) {
            // Create the letter-pair container (Cipher letter + Input box)
            const pairDiv = document.createElement('div');
            pairDiv.classList.add('letter-pair');
            
            // 1. Cipher Letter (Top)
            const cipherSpan = document.createElement('span');
            cipherSpan.textContent = cipherChar;
            cipherSpan.classList.add('cipher-char');
            pairDiv.appendChild(cipherSpan);

            // 2. Plaintext Input (Bottom)
            const plainInput = document.createElement('input');
            plainInput.type = 'text';
            // Use a data attribute to link inputs to their cipher letter
            plainInput.setAttribute('data-cipher-char', cipherChar); 
            plainInput.classList.add('plain-input');
            plainInput.maxLength = 1;
            
            // Pre-fill if a mapping already exists
            plainInput.value = substitutionMap[cipherChar] || '';

            // Attach the handler that updates the map and all matching inputs
            plainInput.addEventListener('input', (e) => handlePlainTextInput(e, cipherChar));

            pairDiv.appendChild(plainInput);
            puzzleGridDisplay.appendChild(pairDiv);
            
        } else {
            // Non-letter characters (spaces/punctuation) - just display them
            const separatorSpan = document.createElement('span');
            separatorSpan.textContent = cipherChar;
            separatorSpan.classList.add('separator-char');
            puzzleGridDisplay.appendChild(separatorSpan);
        }
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
    cipherRow.classList.add('mapping-row', 'cipher-row');
    plainRow.classList.add('mapping-row', 'plain-row');

    // 1. Frequency Row Label
    const freqLabel = document.createElement('div');
    freqLabel.classList.add('mapping-label');
    freqLabel.textContent = 'Count:';
    freqRow.appendChild(freqLabel);
    
    // 2. Cipher Row Label
    const cipherLabel = document.createElement('div');
    cipherLabel.classList.add('mapping-label');
    cipherLabel.textContent = 'Cipher:';
    cipherRow.appendChild(cipherLabel);

    // 3. Plain Row Label
    const plainLabel = document.createElement('div');
    plainLabel.classList.add('mapping-label');
    plainLabel.textContent = 'Plain:';
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
        cipherItem.classList.add('mapping-cell');
        cipherItem.textContent = cipher;
        cipherRow.appendChild(cipherItem);

        // Plaintext Row Item (Guess)
        const plain = substitutionMap[cipher] || '_';
        const plainItem = document.createElement('div');
        plainItem.classList.add('mapping-cell');
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
    // Collect all the decoded letters from the map
    let currentDecryptedText = currentCiphertext.split('').map(cipherChar => {
        if (ALPHABET.includes(cipherChar)) {
            return substitutionMap[cipherChar] || '_';
        }
        return cipherChar;
    }).join('');

    // Remove non-letters for comparison, ensure consistent casing
    const cleanDecrypted = currentDecryptedText.replace(/[^A-Z]/g, '');
    const cleanPlaintext = currentPlaintext.replace(/[^A-Z]/g, '');

    if (cleanDecrypted === cleanPlaintext && cleanPlaintext.length > 0) {
        messageArea.textContent = 'CONGRATULATIONS! Puzzle Solved!';
        messageArea.style.color = 'green';
    } else {
        // Clear status message unless it's the conflict warning
        if (messageArea.textContent.includes('CONGRATULATIONS') || messageArea.textContent.includes('Conflict resolved')) {
            // Keep the solved message or conflict warning
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
    messageArea.style.color = '#007bff';
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
    messageArea.style.color = '#dc3545';
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load the puzzles first
    await loadPuzzles();
    
    // 2. Generate the first puzzle once data is ready
    if (loadedPuzzles.length > 0) {
        generateNewPuzzle();
    }
    
    // Attach listeners to buttons
    clearButton.addEventListener('click', clearMappings);
    newPuzzleButton.addEventListener('click', generateNewPuzzle);
    giveUpButton.addEventListener('click', giveUp); // Attach new listener
    
    // Initial check to ensure everything is rendered
    if (currentCiphertext) {
        renderPuzzleGrid(); 
    }
    updateMappingTable();
});