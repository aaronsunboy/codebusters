import React, { useState, useEffect, useCallback, useMemo } from 'react';

// The alphabet for the CIPHERTEXT (always English A-Z for substitution ciphers)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Normalizes text for cipher operations: retains special non-English characters
 * (like Ñ, Á, É, etc.) and punctuation/spaces, but capitalizes English letters.
 * The core substitution only happens on A-Z.
 */
const normalizeText = (text) => {
  return text.toUpperCase();
};

// --- CORE CIPHER LOGIC ---

/**
 * Creates a monoalphabetic substitution key.
 * @param {string} quote The original quote (plaintext).
 * @returns {{key: object, ciphertext: string}}
 */
const generateCipher = (quote) => {
  const normalizedPlaintext = normalizeText(quote);
  
  // 1. Create a shuffled English alphabet for the cipher mapping
  let shuffledAlphabet = [...ALPHABET].sort(() => Math.random() - 0.5);
  
  // Ensure no letter maps to itself (Derangement constraint, common in aristocrats/xenocrypts)
  // This loop ensures the substitution is not trivial (e.g., A maps to A)
  let attempts = 0;
  while (ALPHABET.some((letter, i) => letter === shuffledAlphabet[i])) {
    shuffledAlphabet = [...ALPHABET].sort(() => Math.random() - 0.5);
    attempts++;
    if (attempts > 100) { 
        // If it takes too long (rare), just break and accept a few self-mappings
        break; 
    }
  }

  // 2. Build the original mapping: Plaintext A -> Ciphertext B
  const originalMapping = {};
  ALPHABET.forEach((plain, i) => {
    originalMapping[plain] = shuffledAlphabet[i];
  });

  // 3. Encrypt the quote
  const ciphertext = normalizedPlaintext.split('').map(char => {
    // Only substitute English letters A-Z
    if (ALPHABET.includes(char)) {
      return originalMapping[char];
    }
    // Pass through all other characters (spaces, punctuation, Spanish letters like Ñ)
    return char;
  }).join('');

  return { 
    originalMapping: originalMapping, 
    ciphertext: ciphertext,
    // Store the plaintext which includes the non-English characters
    truePlaintext: normalizedPlaintext 
  };
};

/**
 * Calculates the frequency of English letters (A-Z) in the ciphertext.
 * Non-English letters are ignored for frequency analysis.
 */
const getFrequency = (text) => {
  const frequency = {};
  text.split('').forEach(char => {
    if (ALPHABET.includes(char)) {
      frequency[char] = (frequency[char] || 0) + 1;
    }
  });
  
  // Convert to array of {letter: count, percentage: string}
  const totalLetters = Object.values(frequency).reduce((sum, count) => sum + count, 0);
  const sortedFrequency = Object.entries(frequency)
    .map(([letter, count]) => ({
      letter,
      count,
      percentage: ((count / totalLetters) * 100).toFixed(1) + '%'
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  return sortedFrequency;
};


const XenocryptPractice = () => {
  // State variables for the puzzle and user interaction
  const [puzzleData, setPuzzleData] = useState(null); // { originalMapping, ciphertext, truePlaintext }
  const [substitutions, setSubstitutions] = useState({}); // { CipherLetter: PlainLetter }
  const [selectedLetter, setSelectedLetter] = useState(null); // The cipher letter being mapped
  const [frequency, setFrequency] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [languageHint, setLanguageHint] = useState('');
  
  // Spanish quotes, which often include Ñ, Á, É, Í, Ó, Ú
  const puzzles = useMemo(() => ([
    {
      quote: "SIEMPRE ES MÁS FACIL DESTRUIR QUE CONSTRUIR.",
      language: "Spanish",
      source: "Proverbio"
    },
    {
      quote: "LA LIBERTAD ES EL DERECHO QUE TIENEN LAS PERSONAS PARA ACTUAR SIN SER ESCLAVIZADOS.",
      language: "Spanish",
      source: "Definición general"
    },
    {
      quote: "LA MÚSICA EXPRESA LO QUE NO PUEDE SER DICHO Y AQUELLO SOBRE LO QUE ES IMPOSIBLE PERMANECER EN SILENCIO.",
      language: "Spanish",
      source: "Victor Hugo"
    },
    {
      quote: "AÑOS DE LUCHA POR UN MAÑANA MEJOR.",
      language: "Spanish",
      source: "Lema"
    },
    {
      quote: "EL VIAJE DE MIL MILLAS COMIENZA CON UN SOLO PASO.",
      language: "Spanish",
      source: "Lao Tzu"
    }
  ]), []);
  
  
  const generateNewPuzzle = useCallback(() => {
    // Stop and reset timer
    setIsRunning(false);
    setTimeElapsed(0);
    setIsSolved(false);

    // Pick a random quote
    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
    const { originalMapping, ciphertext, truePlaintext } = generateCipher(puzzle.quote);

    setPuzzleData({ originalMapping, ciphertext, truePlaintext });
    setSubstitutions({});
    setSelectedLetter(null);
    setFrequency(getFrequency(ciphertext));
    setLanguageHint(puzzle.language);
    
    // Start the timer
    setIsRunning(true);
  }, [puzzles]);

  useEffect(() => {
    if (!puzzleData) {
      generateNewPuzzle();
    }
  }, [puzzleData, generateNewPuzzle]);

  // Timer Effect
  useEffect(() => {
    let interval;
    if (isRunning && !isSolved) {
      interval = setInterval(() => {
        setTimeElapsed(prevTime => prevTime + 1);
      }, 1000);
    } else if (!isRunning) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, isSolved]);
  
  
  // Derived state for the current deciphered plaintext
  const currentPlaintext = useMemo(() => {
    if (!puzzleData) return '';
    return puzzleData.ciphertext.split('').map(cipherChar => {
      // 1. Check if the cipher character is an English letter (A-Z)
      if (ALPHABET.includes(cipherChar)) {
        // 2. If substituted, show the plaintext letter
        if (substitutions[cipherChar]) {
          return substitutions[cipherChar];
        }
        // 3. If not substituted, show a placeholder
        return '_';
      }
      // 4. If it's a non-English character, punctuation, or space, pass it through
      return cipherChar;
    }).join('');
  }, [puzzleData, substitutions]);
  
  // Check for solution
  useEffect(() => {
    if (puzzleData) {
        // The comparison needs to ignore punctuation/spaces but keep the non-English letters (Ñ, Á, etc.)
        const currentClean = currentPlaintext.replace(/[^A-ZÑÁÉÍÓÚ]/g, '');
        const trueClean = puzzleData.truePlaintext.replace(/[^A-ZÑÁÉÍÓÚ]/g, '');

        if (currentClean === trueClean) {
            setIsSolved(true);
            setIsRunning(false);
        }
    }
  }, [currentPlaintext, puzzleData]);


  // Handler for selecting a ciphertext letter
  const handleCipherLetterClick = (cipherLetter) => {
    // If the letter is already selected, unselect it.
    if (selectedLetter === cipherLetter) {
      setSelectedLetter(null);
    } else {
      setSelectedLetter(cipherLetter);
    }
  };

  // Handler for setting the substitution (mapping the selected cipher letter to a plain letter)
  const handleSubstitution = (plainLetter) => {
    if (!selectedLetter) return;

    // Check if the chosen plaintext letter is already used by a different cipher letter
    const existingCipherLetter = Object.keys(substitutions).find(
      key => key !== selectedLetter && substitutions[key] === plainLetter
    );

    if (existingCipherLetter) {
      // If used, remove the old mapping and apply the new one.
      const newSubs = { ...substitutions };
      delete newSubs[existingCipherLetter];
      newSubs[selectedLetter] = plainLetter;
      setSubstitutions(newSubs);
    } else {
      // Standard substitution
      setSubstitutions(prev => ({
        ...prev,
        [selectedLetter]: plainLetter
      }));
    }

    // After substitution, unselect the cipher letter to prepare for the next action
    setSelectedLetter(null);
  };
  
  // Handler for removing a substitution
  const handleClearSubstitution = (cipherLetter) => {
    const newSubs = { ...substitutions };
    delete newSubs[cipherLetter];
    setSubstitutions(newSubs);
    setSelectedLetter(null);
  };
  
  // Format time for display
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };


  if (!puzzleData) {
    return <div className="text-center p-8 text-xl font-semibold">Loading Xenocrypt...</div>;
  }
  
  // Filter frequency to only show a maximum of 10 for simplicity
  const topFrequency = frequency.slice(0, 10);

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">Xenocrypt Practice</h1>
        <p className="text-xl text-gray-600">Monoalphabetic Substitution with a Foreign Language (Aristocrat Format)</p>
        <p className="text-sm text-blue-600 font-semibold mt-2">
            Language Hint: {languageHint} (Note: Non-English characters are not encrypted)
        </p>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Status and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="text-lg font-mono font-bold text-gray-700 mb-2 sm:mb-0">
            Time: {formatTime(timeElapsed)}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowHints(!showHints)}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-150 shadow-md"
            >
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </button>
            <button
              onClick={generateNewPuzzle}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 shadow-md"
            >
              New Puzzle
            </button>
          </div>
        </div>
        
        {isSolved && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded shadow-lg transition-all duration-300 transform scale-100 animate-pulse">
            <p className="font-bold text-lg">SOLVED!</p>
            <p>You successfully deciphered the Xenocrypt!</p>
          </div>
        )}
        
        {/* Ciphertext and Plaintext Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Ciphertext Card */}
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 border-b pb-2">Ciphertext</h2>
            <div className="font-mono text-2xl tracking-widest leading-relaxed whitespace-pre-wrap break-words">
              {puzzleData.ciphertext.split('').map((char, index) => {
                const isCipherLetter = ALPHABET.includes(char);
                const isSelected = char === selectedLetter;
                
                return (
                  <span
                    key={index}
                    onClick={() => isCipherLetter && handleCipherLetterClick(char)}
                    className={`inline-block mx-0.5 my-0.5 p-0.5 rounded transition duration-100 select-none ${
                      isCipherLetter 
                        ? (isSelected ? 'bg-yellow-400 cursor-pointer shadow-md text-gray-900' : 'hover:bg-gray-100 cursor-pointer text-red-600')
                        : 'text-gray-500' // Non-cipher chars (spaces, punctuation, Ñ, Á, etc.)
                    } ${
                        isCipherLetter && substitutions[char] ? 'bg-blue-100 font-bold text-blue-700' : ''
                    }`}
                    title={isCipherLetter ? `Cipher: ${char}` : `Foreign/Punctuation: ${char}`}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Plaintext Card */}
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 border-b pb-2">Plaintext Attempt</h2>
            <div className="font-mono text-2xl tracking-widest leading-relaxed whitespace-pre-wrap break-words">
              {currentPlaintext.split('').map((char, index) => {
                const isPlainLetter = ALPHABET.includes(puzzleData.ciphertext[index]); // Is the original char one we substitute?
                const cipherChar = puzzleData.ciphertext[index];
                
                // Find if this character is part of the currently selected cipher group
                const isHighlight = selectedLetter && cipherChar === selectedLetter;
                
                return (
                  <span 
                    key={index} 
                    className={`inline-block mx-0.5 my-0.5 p-0.5 rounded transition duration-100 select-none ${
                      isPlainLetter 
                        ? (isHighlight ? 'bg-yellow-200 font-extrabold text-red-700' : 'text-green-700 font-medium')
                        : 'text-gray-500' // Non-substituted characters (Ñ, Á, punctuation)
                    }`}
                    title={isPlainLetter ? `Cipher: ${cipherChar}` : `Foreign/Punctuation: ${char}`}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
            
            {/* Solution Display (Hidden until solved or hints enabled) */}
            {(isSolved || showHints) && (
                <div className="mt-6 border-t pt-4">
                    <h3 className="text-xl font-bold text-green-600 mb-2">
                        {isSolved ? 'Solution' : 'True Plaintext (Hidden Hint)'}
                    </h3>
                    <div className="font-mono text-2xl tracking-widest leading-relaxed whitespace-pre-wrap break-words text-green-800">
                        {puzzleData.truePlaintext}
                    </div>
                </div>
            )}
            
          </div>
        </div>

        {/* Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Frequency Analysis */}
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 lg:col-span-1">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Ciphertext Frequency (A-Z only)</h3>
            <div className="space-y-1">
              {topFrequency.map(({ letter, count, percentage }) => (
                <div key={letter} className="flex justify-between items-center font-mono text-sm bg-gray-50 p-2 rounded">
                  <span className="font-bold text-lg text-red-600 w-6">{letter}</span>
                  <div className="flex-1 mx-2 h-4 bg-gray-200 rounded overflow-hidden">
                    <div 
                      className="h-full bg-red-400 transition-all duration-500" 
                      style={{ width: percentage }}
                    ></div>
                  </div>
                  <span className="w-16 text-right text-gray-600">{count} ({percentage})</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Substitution Controls */}
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 lg:col-span-2">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
                Substitution Key
                {selectedLetter && (
                    <span className="ml-3 px-3 py-1 text-sm font-bold bg-yellow-400 rounded-full shadow-inner">
                        Mapping Cipher: {selectedLetter}
                    </span>
                )}
            </h3>
            
            {/* Cipher Alphabet: Red (Cipher) to Blue (Plain) */}
            <div className="mb-6 grid grid-cols-6 sm:grid-cols-10 gap-2">
              {ALPHABET.map(cipher => {
                const plain = substitutions[cipher] || '';
                const isSelected = cipher === selectedLetter;
                const isMapped = !!plain;
                
                return (
                  <div 
                    key={cipher} 
                    className={`flex flex-col items-center justify-center p-2 rounded shadow transition-all duration-150 h-20 
                      ${isSelected ? 'bg-yellow-500 shadow-lg ring-4 ring-yellow-300' : 'bg-gray-100 hover:bg-gray-200 cursor-pointer'}
                      ${isMapped ? 'border-b-4 border-blue-500' : 'border-b-4 border-gray-300'}`
                    }
                    onClick={() => handleCipherLetterClick(cipher)}
                  >
                    <span className="font-mono text-sm font-bold text-red-600 mb-1">Cipher</span>
                    <span className="font-mono text-xl font-extrabold text-red-800">{cipher}</span>
                    <span className="text-xs text-gray-500 mt-1">maps to:</span>
                    <span className="font-mono text-xl font-extrabold text-blue-700 h-6">
                        {plain || '?'}
                    </span>
                    {plain && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClearSubstitution(cipher); }}
                            className="text-xs text-gray-500 hover:text-red-500 mt-1"
                            title={`Clear mapping ${cipher} -> ${plain}`}
                        >
                            (Clear)
                        </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Plaintext Target Alphabet */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-semibold mb-3 text-lg">Select Plaintext Letter (A-Z)</h4>
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                {ALPHABET.map(plainLetter => {
                  const isUsed = Object.values(substitutions).includes(plainLetter);
                  const isMappedToSelected = selectedLetter && substitutions[selectedLetter] === plainLetter;
                  
                  return (
                    <button
                      key={plainLetter}
                      onClick={() => handleSubstitution(plainLetter)}
                      disabled={!selectedLetter}
                      className={`p-3 rounded font-mono text-lg font-bold transition duration-150 shadow 
                        ${!selectedLetter ? 'bg-gray-200 cursor-not-allowed text-gray-500' : ''}
                        ${isMappedToSelected 
                          ? 'bg-blue-600 text-white ring-2 ring-blue-800'
                          : isUsed 
                            ? 'bg-red-200 text-red-600 hover:bg-red-300' 
                            : 'bg-gray-100 hover:bg-green-100 text-gray-800'
                        }
                      `}
                      title={isUsed && !isMappedToSelected ? 'Already used by another cipher letter' : `Map ${selectedLetter} to ${plainLetter}`}
                    >
                      {plainLetter}
                    </button>
                  );
                })}
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Debug/Solution Hints (Optional) */}
        {showHints && puzzleData && (
            <div className="mt-8 bg-pink-50 p-6 rounded-lg shadow-inner border border-pink-200">
                <h3 className="text-xl font-bold text-pink-700 mb-3">Debug Info (True Mapping: Cipher &rarr; Plain)</h3>
                <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-13 gap-2 text-sm font-mono">
                    {Object.entries(puzzleData.originalMapping).map(([plain, cipher]) => (
                        <div key={plain} className="bg-pink-100 p-1 rounded text-center">
                            {cipher} &rarr; {plain}
                        </div>
                    ))}
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default XenocryptPractice;