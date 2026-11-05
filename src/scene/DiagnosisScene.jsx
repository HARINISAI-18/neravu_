
import React, { forwardRef } from "react";

function Box({ position, scale, color, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Character({ position, clothes, skin = "#bd896e", seated = false }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, seated ? 0.68 : 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.48, 5, 12]} />
        <meshStandardMaterial color={clothes} />
      </mesh>

      {/* Head */}
      <mesh position={[0, seated ? 1.08 : 1.45, 0]} castShadow>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial color={skin} />
      </mesh>

      {/* Legs */}
      <Box
        position={[-0.09, seated ? 0.22 : 0.27, 0]}
        scale={[0.12, 0.45, 0.14]}
        color="#34313b"
      />
      <Box
        position={[0.09, seated ? 0.22 : 0.27, 0]}
        scale={[0.12, 0.45, 0.14]}
        color="#34313b"
      />
    </group>
  );
}

const DiagnosisScene = forwardRef(function DiagnosisScene(props, ref) {
  return (
    <group ref={ref}>

      {/* Busy hospital staff at reception */}
      <Box position={[3.15, 0.65, -1.0]}
        scale={[2.0, 1.2, 0.8]} color="#d9d2df" />

      <Box position={[3.15, 1.28, -1.0]}
        scale={[2.05, 0.1, 0.85]} color="#ffffff" />

      {/* Doctor working at computer */}
      <Character position={[2.5, 0, -1.5]} clothes="#e8e5ed" />

      <Box position={[2.5, 1.45, -1.5]}
        scale={[0.65, 0.45, 0.08]} color="#34313d" />

      {/* Nurse walking */}
      <Character position={[3.9, 0, -0.15]} clothes="#b7a5c9" />

      {/* Hospital waiting area */}
      <Box position={[2.5, 0.25, 2.1]}
        scale={[2.8, 0.25, 0.75]} color="#aaa1b0" />

      <Character position={[1.7, 0, 2.1]}
        clothes="#78637e" seated />

      <Character position={[2.8, 0, 2.1]}
        clothes="#8b758e" seated />

      {/* Unorganized documents */}
      {Array.from({ length: 12 }, (_, i) => (
        <group
          key={i}
          position={[
            2.3 + (i % 4) * 0.28,
            1.42 + Math.floor(i / 4) * 0.055,
            -0.8 + (i % 3) * 0.12
          ]}
          rotation={[0, 0, (i % 2 ? 1 : -1) * 0.08]}
        >
          <Box position={[0, 0, 0]}
            scale={[0.24, 0.025, 0.32]}
            color={i % 2 ? "#ffffff" : "#e8e0ed"} />
        </group>
      ))}

      {/* Financial uncertainty symbols */}
      <group position={[-3.0, 1.8, 0.5]}>
        <Box position={[0, 0, 0]}
          scale={[0.55, 0.06, 0.45]}
          color="#d8cddd" />
      </group>

      {/* Hospital notice board */}
      <Box position={[0.8, 2.5, -3.25]}
        scale={[2.0, 1.0, 0.12]} color="#e3dce8" />

      {/* Unanswered information notices */}
      <Box position={[0.8, 2.55, -3.17]}
        scale={[1.5, 0.035, 0.02]} color="#a99bb2" />

      <Box position={[0.8, 2.3, -3.17]}
        scale={[1.1, 0.035, 0.02]} color="#a99bb2" />

    </group>
  );
});

export default DiagnosisScene;
