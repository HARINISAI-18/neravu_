
import React, { forwardRef } from "react";
import { Html } from "@react-three/drei";

function Box({ position, scale, color, radius = 0.8 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial color={color} roughness={radius} />
    </mesh>
  );
}

function SupportCard({ position, title, subtitle, color = "#ffffff" }) {
  return (
    <group position={position}>
      <Box
        position={[0, 0, 0]}
        scale={[1.25, 0.85, 0.08]}
        color={color}
      />
      <Html
        position={[0, 0, 0.055]}
        transform
        distanceFactor={5}
        occlude={false}
      >
        <div style={{
          width: "170px",
          padding: "13px",
          borderRadius: "12px",
          background: "white",
          color: "#30243c",
          fontFamily: "Arial, sans-serif",
          boxShadow: "0 8px 25px rgba(70,40,90,.15)"
        }}>
          <div style={{
            color: "#7843a1",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "1px"
          }}>
            {title}
          </div>
          <div style={{
            fontSize: "12px",
            marginTop: "8px",
            lineHeight: 1.4
          }}>
            {subtitle}
          </div>
          <div style={{
            height: "4px",
            width: "75%",
            borderRadius: "5px",
            background: "#c9a5e5",
            marginTop: "10px"
          }} />
        </div>
      </Html>
    </group>
  );
}

function Counsellor({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.55, 5, 12]} />
        <meshStandardMaterial color="#765092" />
      </mesh>

      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial color="#bd896e" />
      </mesh>
    </group>
  );
}

const HopeScene = forwardRef(function HopeScene(props, ref) {
  return (
    <group ref={ref}>

      {/* Neravu assistance desk */}
      <Box
        position={[3.0, 0.65, 1.0]}
        scale={[2.0, 1.25, 0.85]}
        color="#d8c5e7"
      />

      <Box
        position={[3.0, 1.3, 1.0]}
        scale={[2.08, 0.1, 0.9]}
        color="#ffffff"
      />

      {/* Neravu branding panel */}
      <Box
        position={[3.0, 2.2, 0.55]}
        scale={[1.8, 0.85, 0.12]}
        color="#75449b"
      />

      <Html
        position={[3.0, 2.2, 0.63]}
        transform
        distanceFactor={5}
      >
        <div style={{
          color: "white",
          fontFamily: "Arial",
          textAlign: "center",
          width: "170px"
        }}>
          <div style={{ fontSize: "22px", fontWeight: 800 }}>
            ♡ Neravu
          </div>
          <div style={{ fontSize: "10px", marginTop: "6px" }}>
            SUPPORT AT EVERY STEP
          </div>
        </div>
      </Html>

      {/* Human counsellor */}
      <Counsellor position={[2.0, 0, 1.8]} />

      {/* Assistance pathway cards */}
      <SupportCard
        position={[-2.2, 2.5, -0.3]}
        title="GOVERNMENT SCHEMES"
        subtitle="Find potentially eligible financial support"
      />

      <SupportCard
        position={[-0.7, 2.5, -0.3]}
        title="INSURANCE BENEFITS"
        subtitle="Understand coverage and claim steps"
      />

      <SupportCard
        position={[0.8, 2.5, -0.3]}
        title="NGO ASSISTANCE"
        subtitle="Discover verified charitable support"
      />

      <SupportCard
        position={[2.3, 2.5, -0.3]}
        title="DOCUMENT CHECKLIST"
        subtitle="Prepare the documents you need"
      />

      {/* Application progress station */}
      <Box
        position={[-2.4, 0.6, 1.5]}
        scale={[1.3, 1.1, 0.7]}
        color="#e7dbee"
      />

      <Box
        position={[-2.4, 1.2, 1.5]}
        scale={[1.35, 0.08, 0.75]}
        color="#ffffff"
      />

      <SupportCard
        position={[-2.4, 2.0, 1.4]}
        title="APPLICATION TRACKER"
        subtitle="See progress and understand your next step"
      />

      {/* Purple pathway connecting services */}
      <mesh
        position={[0, 0.04, 1.0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.0, 2.08, 80]} />
        <meshBasicMaterial
          color="#a56bc9"
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Human support point */}
      <mesh position={[1.0, 0.12, 2.2]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial
          color="#a56bc9"
          emissive="#a56bc9"
          emissiveIntensity={0.35}
        />
      </mesh>

    </group>
  );
});

export default HopeScene;
