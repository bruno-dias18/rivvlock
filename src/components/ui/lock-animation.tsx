import { motion } from 'framer-motion';
import { useState } from 'react';

interface LockAnimationProps {
  isLocked: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LockAnimation = ({ isLocked, onClick, size = 'md', className }: LockAnimationProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  };

  const iconSize = {
    sm: 24,
    md: 48,
    lg: 64
  };

  return (
    <motion.div
      className={`relative cursor-pointer ${sizeClasses[size]} ${className}`}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Lock Body */}
      <motion.div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
        style={{
          width: iconSize[size] * 0.6,
          height: iconSize[size] * 0.4,
          backgroundColor: isLocked ? '#3B82F6' : '#10B981',
          borderRadius: '4px',
        }}
        animate={{
          backgroundColor: isLocked ? '#3B82F6' : '#10B981',
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Lock Shackle */}
      <motion.div
        className="absolute top-0 left-1/2 transform -translate-x-1/2"
        style={{
          width: iconSize[size] * 0.4,
          height: iconSize[size] * 0.35,
          border: `${iconSize[size] * 0.06}px solid ${isLocked ? '#3B82F6' : '#10B981'}`,
          borderBottom: 'none',
          borderRadius: `${iconSize[size] * 0.2}px ${iconSize[size] * 0.2}px 0 0`,
        }}
        animate={{
          rotate: isLocked ? 0 : -45,
          x: isLocked ? 0 : iconSize[size] * 0.1,
          borderColor: isLocked ? '#3B82F6' : '#10B981',
        }}
        transition={{ 
          duration: 0.5,
          type: "spring",
          stiffness: 100
        }}
      />

      {/* Keyhole */}
      <motion.div
        className="absolute"
        style={{
          width: iconSize[size] * 0.08,
          height: iconSize[size] * 0.08,
          backgroundColor: 'white',
          borderRadius: '50%',
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          scale: isHovered ? 1.2 : 1,
        }}
      />
      
      {/* Key slot */}
      <motion.div
        className="absolute"
        style={{
          width: iconSize[size] * 0.02,
          height: iconSize[size] * 0.12,
          backgroundColor: 'white',
          top: '68%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Unlock glow effect */}
      {!isLocked && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Sparkles when unlocked */}
      {!isLocked && (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
};

// RIVVLOCK Logo SVG Component
export const RivvlockLogo = ({ className }: { className?: string }) => {
  return (
    <motion.svg
      width="120"
      height="40"
      viewBox="0 0 120 40"
      className={className}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Lock icon integrated into logo */}
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {/* Lock body */}
        <rect x="2" y="22" width="16" height="12" rx="2" fill="#3B82F6" />
        {/* Lock shackle */}
        <path 
          d="M6 22 L6 16 Q10 12 14 16 L14 22" 
          fill="none" 
          stroke="#3B82F6" 
          strokeWidth="2"
        />
        {/* Keyhole */}
        <circle cx="10" cy="26" r="1.5" fill="white" />
        <rect x="9.5" y="27" width="1" height="3" fill="white" />
      </motion.g>

      {/* Text */}
      <motion.text
        x="24"
        y="25"
        fontSize="16"
        fontWeight="bold"
        fill="#1F2937"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        RIVVLOCK
      </motion.text>
      
      {/* Tagline */}
      <motion.text
        x="24"
        y="35"
        fontSize="8"
        fill="#6B7280"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        Secure Escrow Platform
      </motion.text>
    </motion.svg>
  );
};