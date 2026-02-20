import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { Plus, Minus, Equal, X, Trophy } from 'lucide-react';

// --- Constants ---
const LHS_BG = '#E3F2FD';
const RHS_BG = '#FFFDE7';
const LHS_CARD_BG = '#2196F3'; 
const RHS_CARD_BG = '#FBC02D'; 
const TEXT_COLOR = '#FFFFFF'; 

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTerm = (coefficient, hasVariable, showSign = true) => {
  const absCoeff = Math.abs(coefficient);
  const sign = coefficient >= 0 ? '+' : '-';
  const variablePart = hasVariable ? 'x' : '';
  let coeffPart = absCoeff.toString();
  if (hasVariable && absCoeff === 1) coeffPart = '';
  if (coefficient === 0 && !hasVariable) return '0';
  if (coefficient === 0 && hasVariable) return '0'; 
  return `${showSign ? sign : (coefficient < 0 ? '-' : '')}${coeffPart}${variablePart}`;
};

const getEquationString = (terms) => {
  const lhs = terms.filter(t => t.side === 'lhs').sort((a, b) => (b.hasVariable ? 1 : 0) - (a.hasVariable ? 1 : 0));
  const rhs = terms.filter(t => t.side === 'rhs').sort((a, b) => (b.hasVariable ? 1 : 0) - (a.hasVariable ? 1 : 0));
  const formatSide = (sideTerms) => {
    if (sideTerms.length === 0) return '0';
    return sideTerms.map((t, i) => {
      const str = formatTerm(t.coefficient, t.hasVariable, i > 0);
      return i > 0 ? ` ${str.startsWith('-') ? '- ' + str.substring(1) : '+ ' + str.substring(1)}` : str;
    }).join('');
  };
  return `${formatSide(lhs)} = ${formatSide(rhs)}`;
};

const generateLevel = (difficulty) => {
  const scale = (val) => Math.round(val * difficulty);
  let finalCoeff = 1;
  if (difficulty > 1.2) {
    const options = [2, 3, 4, 5, -2, -3, -4, -5];
    finalCoeff = options[Math.floor(Math.random() * options.length)];
  }
  const rangeX = scale(5);
  const answer = Math.floor(Math.random() * (rangeX * 2 + 1)) - rangeX;
  const minA = 2;
  const maxA = Math.max(minA + 2, scale(6));
  const A = Math.floor(Math.random() * (maxA - minA + 1)) + minA;
  const B = A - finalCoeff;
  const targetConstantDiff = finalCoeff * answer;
  const rangeC = scale(10);
  const C1 = Math.floor(Math.random() * (rangeC * 2 + 1)) - rangeC;
  const C2 = C1 + targetConstantDiff;
  let rawTerms = [
    { coeff: A, hasVar: true, side: 'lhs' },
    { coeff: B, hasVar: true, side: 'rhs' },
    { coeff: C1, hasVar: false, side: 'lhs' },
    { coeff: C2, hasVar: false, side: 'rhs' }
  ];
  if (difficulty > 1.4) {
    const newRawTerms = [];
    rawTerms.forEach(t => {
      if (Math.random() > 0.5 || t.coeff === 0) {
        newRawTerms.push(t);
      } else {
        const splitPart = Math.floor(t.coeff / 2);
        const remainder = t.coeff - splitPart;
        newRawTerms.push({ coeff: splitPart, hasVar: t.hasVar, side: t.side });
        newRawTerms.push({ coeff: remainder, hasVar: t.hasVar, side: t.side });
      }
    });
    rawTerms = newRawTerms;
  }
  return rawTerms.filter(t => t.coeff !== 0).map(t => ({
    id: generateId(),
    coefficient: t.coeff,
    hasVariable: t.hasVar,
    side: t.side
  }));
};

// --- Main App ---
export default function App() {
  const [terms, setTerms] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const difficulty = 1 + Math.floor(solvedCount / 3) * 0.2;

  const [modal, setModal] = useState({ isOpen: false, termA: null, termB: null, inputValue: '', error: null });
  const [divisionModal, setDivisionModal] = useState({ isOpen: false, divisor: 1, dividend: 0, divisorInput: '', resultInput: '', error: null });
  const [canDivide, setCanDivide] = useState(null);
  const containerRef = useRef(null);
  const [containerBounds, setContainerBounds] = useState({ width: 0, height: 0, left: 0, top: 0 });

  useEffect(() => {
    setTerms(generateLevel(1));
  }, []);

  useEffect(() => {
    if (gameWon) { setCanDivide(null); return; }
    if (terms.length === 2) {
      const lhs = terms.filter(t => t.side === 'lhs');
      const rhs = terms.filter(t => t.side === 'rhs');
      if (lhs.length === 1 && rhs.length === 1) {
        const t1 = lhs[0], t2 = rhs[0];
        let varTerm = null, constTerm = null;
        if (t1.hasVariable && !t2.hasVariable) { varTerm = t1; constTerm = t2; }
        else if (!t1.hasVariable && t2.hasVariable) { varTerm = t2; constTerm = t1; }
        if (varTerm && constTerm) {
          if (varTerm.coefficient === 1) {
            setGameWon(true); setScore(s => s + 10); setSolvedCount(c => c + 1); setCanDivide(null);
          } else {
            setCanDivide({ divisor: varTerm.coefficient, dividend: constTerm.coefficient });
          }
        }
      }
    } else { setCanDivide(null); }
  }, [terms, gameWon]);

  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({ width: rect.width, height: rect.height, left: rect.left, top: rect.top });
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  const startNewGame = () => { setGameWon(false); setCanDivide(null); setTerms(generateLevel(difficulty)); };

  const handleDivisionSubmit = (e) => {
    e.preventDefault();
    const userDivisor = parseInt(divisionModal.divisorInput, 10);
    const userResult = parseInt(divisionModal.resultInput, 10);
    const expectedResult = divisionModal.dividend / divisionModal.divisor;
    if (userDivisor === divisionModal.divisor && userResult === expectedResult) {
      setTerms(prev => prev.map(t => ({ ...t, coefficient: t.hasVariable ? 1 : userResult })));
      setDivisionModal({ isOpen: false, divisor: 1, dividend: 0, divisorInput: '', resultInput: '', error: null });
    } else {
      setScore(s => s - 2);
      setDivisionModal(prev => ({ ...prev, error: 'Incorrect. (-2 pts)' }));
    }
  };

  const handleDragEnd = (term, info, element) => {
    if (gameWon) return;
    const cardRect = element.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const containerCenterX = containerBounds.left + containerBounds.width / 2;
    const newSide = cardCenterX < containerCenterX ? 'lhs' : 'rhs';
    const didCross = newSide !== term.side;

    const overlappingTerm = terms.find(t => {
      if (t.id === term.id || t.side !== newSide || t.hasVariable !== term.hasVariable) return false;
      const targetEl = document.getElementById(`card-${t.id}`);
      if (!targetEl) return false;
      const targetRect = targetEl.getBoundingClientRect();
      const overlapX = Math.max(0, Math.min(cardRect.right, targetRect.right) - Math.max(cardRect.left, targetRect.left));
      const overlapY = Math.max(0, Math.min(cardRect.bottom, targetRect.bottom) - Math.max(cardRect.top, targetRect.top));
      return (overlapX * overlapY) > (cardRect.width * cardRect.height * 0.3);
    });

    if (overlappingTerm) {
      const effectiveCoeff = didCross ? -term.coefficient : term.coefficient;
      setModal({ isOpen: true, termA: { ...term, coefficient: effectiveCoeff, side: newSide }, termB: overlappingTerm, inputValue: '', error: null });
    } else if (didCross) {
      setTerms(prev => prev.map(t => t.id === term.id ? { ...t, side: newSide, coefficient: t.coefficient * -1 } : t));
    }
  };

  const handleMergeSubmit = (e) => {
    e.preventDefault();
    const sum = modal.termA.coefficient + modal.termB.coefficient;
    const userSum = parseInt(modal.inputValue, 10);
    if (userSum === sum) {
      setTerms(prev => {
        const filtered = prev.filter(t => t.id !== modal.termA.id && t.id !== modal.termB.id);
        return [...filtered, { id: generateId(), coefficient: sum, hasVariable: sum === 0 ? false : modal.termA.hasVariable, side: modal.termB.side }];
      });
      setModal({ isOpen: false, termA: null, termB: null, inputValue: '', error: null });
    } else {
      setScore(s => s - 2);
      setModal(prev => ({ ...prev, error: 'Incorrect sum. -2 Points!' }));
      setTimeout(() => setModal({ isOpen: false, termA: null, termB: null, inputValue: '', error: null }), 1500);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none touch-none" ref={containerRef}>
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full" style={{ backgroundColor: LHS_BG }} />
        <div className="w-1/2 h-full" style={{ backgroundColor: RHS_BG }} />
      </div>
      <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-black -translate-x-1/2 flex items-center justify-center z-10">
        <div className="bg-black text-white p-2 rounded-full"><Equal size={24} strokeWidth={3} /></div>
      </div>

      {canDivide && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <button onClick={() => setDivisionModal({...divisionModal, isOpen: true, divisor: canDivide.divisor, dividend: canDivide.dividend})} className="bg-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-xl border-4 border-white">Divide</button>
        </div>
      )}

      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-2xl shadow-lg border border-gray-200">
          <span className="text-2xl font-mono font-bold text-gray-800 tracking-wider">{getEquationString(terms)}</span>
        </div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full shadow-md font-bold flex items-center gap-2 z-20">
        <Trophy size={20} className="text-yellow-500" />
        <span>Score: {score}</span>
      </div>

      {terms.map((term) => (
        <DraggableCard key={term.id} term={term} containerBounds={containerBounds} onDragEnd={handleDragEnd} />
      ))}

      {gameWon && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-green-600 mb-4">Solved!</h2>
            <div className="text-4xl font-mono mb-8 bg-gray-100 p-4 rounded-xl">x = {terms.find(t => !t.hasVariable)?.coefficient}</div>
            <button onClick={startNewGame} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold">Next Equation</button>
          </div>
        </div>
      )}

      {divisionModal.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-2xl w-80 shadow-2xl">
            <h2 className="font-bold mb-4 text-center">Division Step</h2>
            <form onSubmit={handleDivisionSubmit} className="space-y-4">
              <input type="number" placeholder="Divisor" value={divisionModal.divisorInput} onChange={e => setDivisionModal({...divisionModal, divisorInput: e.target.value})} className="w-full p-2 border rounded text-center"/>
              <input type="number" placeholder="Result" value={divisionModal.resultInput} onChange={e => setDivisionModal({...divisionModal, resultInput: e.target.value})} className="w-full p-2 border rounded text-center"/>
              {divisionModal.error && <p className="text-red-500 text-xs text-center">{divisionModal.error}</p>}
              <button type="submit" className="w-full py-2 bg-purple-600 text-white rounded">Solve</button>
            </form>
          </div>
        </div>
      )}

      {modal.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-2xl w-80 shadow-2xl">
            <h2 className="font-bold mb-4 text-center">Combine Terms</h2>
            <form onSubmit={handleMergeSubmit} className="space-y-4">
              <input type="number" autoFocus value={modal.inputValue} onChange={e => setModal({...modal, inputValue: e.target.value})} className="w-full p-2 border rounded text-center text-xl"/>
              {modal.error && <p className="text-red-500 text-xs text-center">{modal.error}</p>}
              <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded font-medium">Merge</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DraggableCard({ term, containerBounds, onDragEnd }) {
  const isLHS = term.side === 'lhs';
  const bgColor = useMotionValue(isLHS ? LHS_CARD_BG : RHS_CARD_BG);
  useEffect(() => { bgColor.set(isLHS ? LHS_CARD_BG : RHS_CARD_BG); }, [isLHS]);

  const initialPos = React.useMemo(() => {
    const sideWidth = containerBounds.width / 2;
    const padding = 60;
    const minX = isLHS ? padding : sideWidth + padding;
    const maxX = isLHS ? sideWidth - padding : containerBounds.width - padding;
    return { x: Math.random() * (maxX - minX) + minX, y: Math.random() * (containerBounds.height - 200) + 100 };
  }, [term.side, containerBounds]);

  if (containerBounds.width === 0) return null;

  return (
    <motion.div
      id={`card-${term.id}`} drag dragMomentum={false}
      initial={{ x: initialPos.x, y: initialPos.y }}
      animate={{ x: initialPos.x, y: initialPos.y }}
      style={{ backgroundColor: bgColor, color: TEXT_COLOR, touchAction: 'none' }}
      onDrag={(_, info) => {
        const center = containerBounds.left + containerBounds.width / 2;
        bgColor.set(info.point.x < center ? LHS_CARD_BG : RHS_CARD_BG);
      }}
      onDragEnd={(e, info) => onDragEnd(term, info, e.target)}
      className="absolute w-24 h-24 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold cursor-grab active:cursor-grabbing"
    >
      {formatTerm(term.coefficient, term.hasVariable, false)}
    </motion.div>
  );
}
