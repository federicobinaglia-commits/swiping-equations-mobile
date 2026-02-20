import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Plus, Minus, Equal, X, Trophy } from 'lucide-react';

// --- Types ---

type Side = 'lhs' | 'rhs';

interface Term {
  id: string;
  coefficient: number;
  hasVariable: boolean; // true for 'x', false for constant
  side: Side;
  // Position is managed by Framer Motion, but we store initial/reset positions
  x?: number;
  y?: number;
}

interface ModalState {
  isOpen: boolean;
  termA: Term | null;
  termB: Term | null;
  inputValue: string;
  error: string | null;
}

// --- Constants ---

const LHS_BG = '#E3F2FD';
const RHS_BG = '#FFFDE7';
const LHS_CARD_BG = '#2196F3'; // Blue 500
const RHS_CARD_BG = '#FBC02D'; // Yellow 700 (Darker for contrast)
const TEXT_COLOR = '#FFFFFF'; // White text for cards

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTerm = (coefficient: number, hasVariable: boolean, showSign: boolean = true) => {
  const absCoeff = Math.abs(coefficient);
  const sign = coefficient >= 0 ? '+' : '-';
  const variablePart = hasVariable ? 'x' : '';
  
  let coeffPart = absCoeff.toString();
  if (hasVariable && absCoeff === 1) {
    coeffPart = '';
  }

  if (coefficient === 0 && !hasVariable) return '0';
  if (coefficient === 0 && hasVariable) return '0'; 

  return `${showSign ? sign : (coefficient < 0 ? '-' : '')}${coeffPart}${variablePart}`;
};

const getEquationString = (terms: Term[]) => {
  const lhs = terms.filter(t => t.side === 'lhs').sort((a, b) => (b.hasVariable ? 1 : 0) - (a.hasVariable ? 1 : 0));
  const rhs = terms.filter(t => t.side === 'rhs').sort((a, b) => (b.hasVariable ? 1 : 0) - (a.hasVariable ? 1 : 0));

  const formatSide = (sideTerms: Term[]) => {
    if (sideTerms.length === 0) return '0';
    return sideTerms.map((t, i) => {
      const str = formatTerm(t.coefficient, t.hasVariable, i > 0);
      return i > 0 ? ` ${str.startsWith('-') ? '- ' + str.substring(1) : '+ ' + str.substring(1)}` : str;
    }).join('');
  };

  return `${formatSide(lhs)} = ${formatSide(rhs)}`;
};

const generateLevel = (difficulty: number): Term[] => {
  const scale = (val: number) => Math.round(val * difficulty);
  
  // 1. Determine Final Coefficient of x (The "Division" feature)
  // If difficulty > 1.2 (approx score > 50), allow non-1 coefficients
  let finalCoeff = 1;
  if (difficulty > 1.2) {
    const options = [2, 3, 4, 5, -2, -3, -4, -5];
    // Randomly pick, but bias towards positive small numbers initially
    finalCoeff = options[Math.floor(Math.random() * options.length)];
  }

  // 2. Determine Answer (x = ?)
  const rangeX = scale(5); // Keep answer small so multiplication doesn't explode
  const answer = Math.floor(Math.random() * (rangeX * 2 + 1)) - rangeX;

  // Equation logic: (A)x + C1 = (B)x + C2
  // Simplifies to: (A - B)x = C2 - C1
  // We want (A - B) = finalCoeff
  // We want (C2 - C1) = finalCoeff * answer

  // 3. Generate A and B
  const minA = 2;
  const maxA = Math.max(minA + 2, scale(6));
  const A = Math.floor(Math.random() * (maxA - minA + 1)) + minA;
  const B = A - finalCoeff;

  // 4. Generate C1 and C2
  const targetConstantDiff = finalCoeff * answer; // C2 - C1
  const rangeC = scale(10);
  const C1 = Math.floor(Math.random() * (rangeC * 2 + 1)) - rangeC;
  const C2 = C1 + targetConstantDiff;

  let rawTerms: { coeff: number, hasVar: boolean, side: Side }[] = [
    { coeff: A, hasVar: true, side: 'lhs' },
    { coeff: B, hasVar: true, side: 'rhs' },
    { coeff: C1, hasVar: false, side: 'lhs' },
    { coeff: C2, hasVar: false, side: 'rhs' }
  ];

  // 5. Term Splitting (More terms for higher difficulty)
  // If difficulty is high, split some terms
  if (difficulty > 1.4) {
    const newRawTerms: typeof rawTerms = [];
    rawTerms.forEach(t => {
      if (Math.random() > 0.5 || t.coeff === 0) {
        newRawTerms.push(t);
      } else {
        // Split t into t1 + t2 = t
        const splitPart = Math.floor(t.coeff / 2);
        const remainder = t.coeff - splitPart;
        newRawTerms.push({ coeff: splitPart, hasVar: t.hasVar, side: t.side });
        newRawTerms.push({ coeff: remainder, hasVar: t.hasVar, side: t.side });
      }
    });
    rawTerms = newRawTerms;
  }

  // Convert to Term objects
  const newTerms: Term[] = [];
  rawTerms.forEach(t => {
    if (t.coeff !== 0) {
      newTerms.push({
        id: generateId(),
        coefficient: t.coeff,
        hasVariable: t.hasVar,
        side: t.side
      });
    }
  });

  return newTerms;
};

// --- Components ---

export default function App() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  
  // Difficulty increases by 0.2 every 3 solved equations
  const difficulty = 1 + Math.floor(solvedCount / 3) * 0.2;

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    termA: null,
    termB: null,
    inputValue: '',
    error: null,
  });

  const [divisionModal, setDivisionModal] = useState<{
    isOpen: boolean;
    divisor: number;
    dividend: number; // The constant term
    divisorInput: string;
    resultInput: string;
    error: string | null;
  }>({
    isOpen: false,
    divisor: 1,
    dividend: 0,
    divisorInput: '',
    resultInput: '',
    error: null,
  });

  // Initialize game
  useEffect(() => {
    setTerms(generateLevel(1));
  }, []);

  // Check Win / Division Condition
  const [canDivide, setCanDivide] = useState<{ divisor: number, dividend: number } | null>(null);

  useEffect(() => {
    if (gameWon) {
      setCanDivide(null);
      return;
    }

    if (terms.length === 2) {
      const lhs = terms.filter(t => t.side === 'lhs');
      const rhs = terms.filter(t => t.side === 'rhs');
      
      if (lhs.length === 1 && rhs.length === 1) {
        const t1 = lhs[0];
        const t2 = rhs[0];
        
        let varTerm: Term | null = null;
        let constTerm: Term | null = null;

        if (t1.hasVariable && !t2.hasVariable) { varTerm = t1; constTerm = t2; }
        else if (!t1.hasVariable && t2.hasVariable) { varTerm = t2; constTerm = t1; }

        if (varTerm && constTerm) {
          if (varTerm.coefficient === 1) {
            setGameWon(true);
            setScore(s => s + 10);
            setSolvedCount(c => c + 1);
            setCanDivide(null);
          } else {
            // Ready to divide
            setCanDivide({ divisor: varTerm.coefficient, dividend: constTerm.coefficient });
          }
        }
      }
    } else {
      setCanDivide(null);
    }
  }, [terms, gameWon]);

  const startNewGame = () => {
    setGameWon(false);
    setCanDivide(null);
    setTerms(generateLevel(difficulty));
  };

  const handleDivisionClick = () => {
    if (!canDivide) return;
    setDivisionModal({
      isOpen: true,
      divisor: canDivide.divisor,
      dividend: canDivide.dividend,
      divisorInput: '',
      resultInput: '',
      error: null
    });
  };

  const handleDivisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userDivisor = parseInt(divisionModal.divisorInput, 10);
    const userResult = parseInt(divisionModal.resultInput, 10);
    
    const expectedResult = divisionModal.dividend / divisionModal.divisor;

    if (userDivisor === divisionModal.divisor && userResult === expectedResult) {
      // Apply division
      setTerms(prev => prev.map(t => ({
        ...t,
        coefficient: t.hasVariable ? 1 : userResult // x becomes 1x, constant becomes result
      })));
      setDivisionModal({ isOpen: false, divisor: 1, dividend: 0, divisorInput: '', resultInput: '', error: null });
    } else {
      setScore(s => s - 2);
      let errorMsg = 'Incorrect. ';
      if (userDivisor !== divisionModal.divisor) errorMsg += 'Check the divisor. ';
      else if (userResult !== expectedResult) errorMsg += 'Check the math. ';
      setDivisionModal(prev => ({ ...prev, error: errorMsg + '(-2 pts)' }));
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState({ width: 0, height: 0, left: 0, top: 0 });

  // Update container bounds on resize
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
        });
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  // --- Game Logic ---

  const handleDragEnd = (term: Term, info: PanInfo, element: HTMLElement) => {
    if (gameWon) return; 

    const cardRect = element.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const containerCenterX = containerBounds.left + containerBounds.width / 2;
    
    const newSide: Side = cardCenterX < containerCenterX ? 'lhs' : 'rhs';
    const didCross = newSide !== term.side;

    // 1. Check for Collision (Merge)
    const overlappingTerm = terms.find(t => {
      if (t.id === term.id) return false;
      if (t.side !== newSide) return false;
      if (t.hasVariable !== term.hasVariable) return false;

      const targetEl = document.getElementById(`card-${t.id}`);
      if (!targetEl) return false;
      const targetRect = targetEl.getBoundingClientRect();
      
      const overlapX = Math.max(0, Math.min(cardRect.right, targetRect.right) - Math.max(cardRect.left, targetRect.left));
      const overlapY = Math.max(0, Math.min(cardRect.bottom, targetRect.bottom) - Math.max(cardRect.top, targetRect.top));
      const overlapArea = overlapX * overlapY;
      const cardArea = cardRect.width * cardRect.height;
      
      return overlapArea > (cardArea * 0.3);
    });

    if (overlappingTerm) {
      let effectiveCoefficient = term.coefficient;
      if (didCross) {
        effectiveCoefficient = -1 * term.coefficient;
      }

      setModal({
        isOpen: true,
        termA: { ...term, coefficient: effectiveCoefficient, side: newSide },
        termB: overlappingTerm,
        inputValue: '',
        error: null,
      });
      return;
    }

    // 2. Handle Side Crossing (Flip Sign)
    if (didCross) {
      setTerms(prev => prev.map(t => {
        if (t.id === term.id) {
          return {
            ...t,
            side: newSide,
            coefficient: t.coefficient * -1
          };
        }
        return t;
      }));
    }
  };

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.termA || !modal.termB) return;

    const sum = modal.termA.coefficient + modal.termB.coefficient;
    const userSum = parseInt(modal.inputValue, 10);

    if (isNaN(userSum)) {
      setModal(prev => ({ ...prev, error: 'Please enter a valid number' }));
      return;
    }

    if (userSum === sum) {
      const isZero = sum === 0;
      const newTerm: Term = {
        id: generateId(),
        coefficient: sum,
        hasVariable: isZero ? false : modal.termA.hasVariable, 
        side: modal.termB.side,
      };

      setTerms(prev => {
        const filtered = prev.filter(t => t.id !== modal.termA!.id && t.id !== modal.termB!.id);
        return [...filtered, newTerm];
      });
      setModal({ isOpen: false, termA: null, termB: null, inputValue: '', error: null });
    } else {
      setScore(s => s - 2); 
      setModal(prev => ({ ...prev, error: 'Incorrect sum. -2 Points!' }));
      setTimeout(() => {
          setModal({ isOpen: false, termA: null, termB: null, inputValue: '', error: null });
          setTerms(prev => [...prev]); 
      }, 1500);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none touch-none" ref={containerRef}>
      
      {/* Backgrounds */}
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full" style={{ backgroundColor: LHS_BG }} />
        <div className="w-1/2 h-full" style={{ backgroundColor: RHS_BG }} />
      </div>

      {/* Center Divider */}
      <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-black -translate-x-1/2 flex items-center justify-center z-10">
        <div className="bg-black text-white p-2 rounded-full">
          <Equal size={24} strokeWidth={3} />
        </div>
      </div>

      {/* Division Button (Contextual) */}
      {canDivide && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
           <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={handleDivisionClick}
            className="bg-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-xl border-4 border-white"
           >
             Divide
           </motion.button>
        </div>
      )}

      {/* Labels */}
      <div className="absolute top-4 left-4 text-blue-900/50 font-bold text-xl pointer-events-none">LHS</div>
      <div className="absolute top-4 right-4 text-yellow-900/50 font-bold text-xl pointer-events-none">RHS</div>

      {/* Equation Display */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-2xl shadow-lg border border-gray-200">
           <span className="text-2xl font-mono font-bold text-gray-800 tracking-wider">
             {getEquationString(terms)}
           </span>
        </div>
      </div>

      {/* Score Board */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md font-bold text-gray-800 flex items-center gap-2 z-20">
        <Trophy size={20} className="text-yellow-500" />
        <span>Score: {score}</span>
        <span className="text-xs text-gray-500 font-normal ml-2 border-l pl-2 border-gray-300">
          Diff: {difficulty.toFixed(1)}x
        </span>
      </div>

      {/* New Game Button */}
      <button 
        onClick={startNewGame}
        className="absolute bottom-4 right-4 z-30 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-4 rounded-full shadow-md transition-colors"
      >
        Skip Level
      </button>

      {/* Cards */}
      {terms.map((term) => (
        <DraggableCard 
          key={term.id} 
          term={term} 
          containerBounds={containerBounds}
          onDragEnd={handleDragEnd}
        />
      ))}

      {/* Win Modal */}
      {gameWon && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm mx-4"
          >
            <h2 className="text-3xl font-bold mb-2 text-green-600">Solved!</h2>
            <p className="text-gray-600 mb-2 text-lg">You found the value of x.</p>
            <div className="text-green-500 font-bold text-xl mb-6">+10 Points</div>
            
            <div className="text-4xl font-mono mb-8 bg-gray-100 p-4 rounded-xl">
              x = {terms.find(t => !t.hasVariable)?.coefficient}
            </div>
            <button
              onClick={startNewGame}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 shadow-lg transform transition hover:scale-105"
            >
              Next Equation
            </button>
          </motion.div>
        </div>
      )}

      {/* Division Modal */}
      {divisionModal.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-2xl w-80 max-w-full"
          >
            <h2 className="text-xl font-bold mb-4 text-center">Division Step</h2>
            <p className="text-center text-gray-600 mb-4 text-sm">
              Isolate x by dividing both sides.
            </p>
            
            <form onSubmit={handleDivisionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Divide by:</label>
                <input
                  type="number"
                  autoFocus
                  value={divisionModal.divisorInput}
                  onChange={(e) => setDivisionModal(prev => ({ ...prev, divisorInput: e.target.value, error: null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-center text-lg"
                  placeholder="Divisor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result ({divisionModal.dividend} ÷ ?):
                </label>
                <input
                  type="number"
                  value={divisionModal.resultInput}
                  onChange={(e) => setDivisionModal(prev => ({ ...prev, resultInput: e.target.value, error: null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-center text-lg"
                  placeholder="Result"
                />
              </div>

              {divisionModal.error && (
                <p className="text-red-500 text-sm text-center font-bold">{divisionModal.error}</p>
              )}

              <div className="flex space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setDivisionModal({ isOpen: false, divisor: 1, dividend: 0, divisorInput: '', resultInput: '', error: null })}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Solve
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Merge Modal */}
      {modal.isOpen && modal.termA && modal.termB && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-2xl w-80 max-w-full"
          >
            <h2 className="text-xl font-bold mb-4 text-center">Combine Terms</h2>
            <div className="flex items-center justify-center space-x-2 mb-6 text-lg font-medium">
              <span className={`px-3 py-1 rounded-lg ${modal.termA.side === 'lhs' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {formatTerm(modal.termA.coefficient, modal.termA.hasVariable)}
              </span>
              <Plus size={16} className="text-gray-400" />
              <span className={`px-3 py-1 rounded-lg ${modal.termB.side === 'lhs' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {formatTerm(modal.termB.coefficient, modal.termB.hasVariable)}
              </span>
              <Equal size={16} className="text-gray-400" />
              <span className="text-gray-400">?</span>
            </div>

            <form onSubmit={handleMergeSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result Coefficient
                </label>
                <input
                  type="number"
                  autoFocus
                  value={modal.inputValue}
                  onChange={(e) => setModal(prev => ({ ...prev, inputValue: e.target.value, error: null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-xl"
                  placeholder="?"
                />
                {modal.error && (
                  <p className="text-red-500 text-sm mt-2 text-center font-bold">{modal.error}</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setModal({ isOpen: false, termA: null, termB: null, inputValue: '', error: null })}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Merge
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Draggable Card Component ---

interface DraggableCardProps {
  term: Term;
  containerBounds: { width: number; height: number; left: number; top: number };
  onDragEnd: (term: Term, info: PanInfo, element: HTMLElement) => void;
}

function DraggableCard({ term, containerBounds, onDragEnd }: DraggableCardProps) {
  const isLHS = term.side === 'lhs';
  
  // Motion value for background color to allow performant updates during drag
  const bgColor = useMotionValue(isLHS ? LHS_CARD_BG : RHS_CARD_BG);

  // Update color when side changes in state (e.g. after drop)
  useEffect(() => {
    bgColor.set(isLHS ? LHS_CARD_BG : RHS_CARD_BG);
  }, [isLHS, bgColor]);

  // Random position within the correct side
  const initialPos = React.useMemo(() => {
    const sideWidth = containerBounds.width / 2;
    const padding = 60;
    const minX = isLHS ? padding : sideWidth + padding;
    const maxX = isLHS ? sideWidth - padding : containerBounds.width - padding;
    const minY = 100;
    const maxY = containerBounds.height - 100;

    return {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY,
    };
  }, [term.side, containerBounds.width, containerBounds.height]);

  // Handle drag to update color in real-time
  const handleDrag = (_: any, info: PanInfo) => {
    if (containerBounds.width === 0) return;
    
    // Check if crossed center line
    // info.point is viewport coordinates
    const centerLine = containerBounds.left + containerBounds.width / 2;
    const isNowLHS = info.point.x < centerLine;
    
    bgColor.set(isNowLHS ? LHS_CARD_BG : RHS_CARD_BG);
  };

  // If container is 0 (first render), don't show yet
  if (containerBounds.width === 0) return null;

  return (
    <motion.div
      id={`card-${term.id}`}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      initial={{ x: initialPos.x, y: initialPos.y, scale: 0 }}
      animate={{ 
        x: initialPos.x, 
        y: initialPos.y, 
        scale: 1,
        // We control background color via style/motionValue for drag updates, 
        // but we also want it to animate if state changes. 
        // Framer Motion handles mixing style and animate well usually.
      }}
      style={{ 
        backgroundColor: bgColor, 
        color: TEXT_COLOR,
        touchAction: 'none'
      }}
      whileHover={{ scale: 1.1, cursor: 'grab', zIndex: 20 }}
      whileDrag={{ scale: 1.2, cursor: 'grabbing', zIndex: 50 }}
      onDrag={handleDrag}
      onDragEnd={(e, info) => onDragEnd(term, info, e.target as HTMLElement)}
      className="absolute w-24 h-24 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold text-white select-none"
    >
      {formatTerm(term.coefficient, term.hasVariable)}
    </motion.div>
  );
}
