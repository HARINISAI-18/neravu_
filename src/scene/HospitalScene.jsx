import React, { useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function Block({ position, size, color = '#ffffff', roughness = 0.78 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function createHumanMotionRefs() {
  const keys = ['torso', 'head', 'leftArm', 'rightArm', 'leftElbow', 'rightElbow', 'leftLeg', 'rightLeg', 'leftShin', 'rightShin'];
  return Object.fromEntries(keys.map((key) => [key, React.createRef()]));
}

function Person({
  position,
  shirt = '#74509a',
  skin = '#bd896e',
  hair = '#382d35',
  seated = false,
  lying = false,
  reaching = false,
  coat = false,
  motionRefs,
}) {
  const defaultRefs = useRef({
    torso: React.createRef(),
    head: React.createRef(),
    leftArm: React.createRef(),
    rightArm: React.createRef(),
    leftElbow: React.createRef(),
    rightElbow: React.createRef(),
    leftLeg: React.createRef(),
    rightLeg: React.createRef(),
    leftShin: React.createRef(),
    rightShin: React.createRef(),
  }).current;
  const refs = motionRefs || defaultRefs;
  const garment = coat ? '#f4f1f5' : shirt;

  return (
    <group position={position}>
      {lying ? (
        <>
          <group ref={refs.torso} position={[0, 0.95, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.23, 0.78, 8, 18]} />
              <meshStandardMaterial color={garment} roughness={0.86} />
            </mesh>
            <mesh position={[-0.37, -0.015, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.19, 0.24, 8, 16]} />
              <meshStandardMaterial color="#403744" roughness={0.9} />
            </mesh>
            <mesh position={[0.37, 0.06, 0]} castShadow>
              <sphereGeometry args={[0.19, 24, 24]} />
              <meshStandardMaterial color={skin} roughness={0.86} />
            </mesh>
            <mesh position={[0.41, 0.18, -0.035]} castShadow>
              <sphereGeometry args={[0.19, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={hair} roughness={0.92} />
            </mesh>
            <mesh position={[0.37, 0.055, 0.177]}>
              <sphereGeometry args={[0.032, 12, 12]} />
              <meshStandardMaterial color="#49353a" roughness={0.8} />
            </mesh>
            <mesh position={[0.05, -0.06, 0.14]} castShadow>
              <sphereGeometry args={[0.095, 16, 16]} />
              <meshStandardMaterial color={skin} roughness={0.9} />
            </mesh>
          </group>
          {[-1, 1].map((side) => (
            <group
              key={side}
              position={[-0.2, 0.91, side * 0.15]}
              rotation={[side * Math.PI / 2, 0, 0]}
            >
              <mesh position={[0, -0.14, 0]} castShadow>
                <capsuleGeometry args={[0.075, 0.2, 6, 12]} />
                <meshStandardMaterial color={garment} roughness={0.86} />
              </mesh>
              <mesh position={[0, -0.35, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.2, 6, 12]} />
                <meshStandardMaterial color={skin} roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.49, 0]} castShadow>
                <sphereGeometry args={[0.07, 14, 14]} />
                <meshStandardMaterial color={skin} roughness={0.9} />
              </mesh>
            </group>
          ))}
          <Block position={[-0.8, 0.94, 0]} size={[1.65, 0.34, 1.18]} color="#eee8f3" />
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[-0.79, 0.92, side * 0.12]} rotation={[0, 0, -Math.PI / 2]} castShadow>
                <capsuleGeometry args={[0.105, 0.38, 6, 12]} />
                <meshStandardMaterial color="#403744" roughness={0.9} />
              </mesh>
              <mesh position={[-1.28, 0.92, side * 0.12]} rotation={[0, 0, -Math.PI / 2]} castShadow>
                <capsuleGeometry args={[0.08, 0.48, 6, 12]} />
                <meshStandardMaterial color="#403744" roughness={0.9} />
              </mesh>
              <mesh position={[-1.61, 0.86, side * 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.075, 0.16, 5, 10]} />
                <meshStandardMaterial color="#302a34" roughness={0.78} />
              </mesh>
            </group>
          ))}
        </>
      ) : (
        <>
          <group ref={refs.torso} position={[0, seated ? 0.96 : 1.13, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.23, seated ? 0.55 : 0.68, 8, 18]} />
              <meshStandardMaterial color={garment} roughness={0.84} />
            </mesh>
            <mesh position={[0, -0.36, 0]} castShadow>
              <sphereGeometry args={[0.225, 20, 16]} />
              <meshStandardMaterial color={garment} roughness={0.88} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.19, 0.27, 0]} castShadow>
                <sphereGeometry args={[0.14, 16, 14]} />
                <meshStandardMaterial color={garment} roughness={0.86} />
              </mesh>
            ))}
            <mesh position={[0, 0.49, 0]} castShadow>
              <sphereGeometry args={[0.09, 14, 12]} />
              <meshStandardMaterial color={skin} roughness={0.88} />
            </mesh>
            {coat && (
              <>
                <mesh position={[-0.08, 0, 0.217]}>
                  <boxGeometry args={[0.018, 0.62, 0.012]} />
                  <meshStandardMaterial color="#c9bfce" />
                </mesh>
                <mesh position={[0.075, 0.08, 0.219]}>
                  <sphereGeometry args={[0.025, 10, 10]} />
                  <meshStandardMaterial color="#9d8da5" metalness={0.25} roughness={0.4} />
                </mesh>
              </>
            )}
          </group>
          <mesh position={[0, seated ? 1.34 : 1.61, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.09, 0.18, 16]} />
            <meshStandardMaterial color={skin} roughness={0.88} />
          </mesh>
          <group ref={refs.head} position={[0, seated ? 1.56 : 1.82, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.2, 28, 24]} />
              <meshStandardMaterial color={skin} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.02, -0.055]} castShadow>
              <sphereGeometry args={[0.205, 24, 18]} />
              <meshStandardMaterial color={hair} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.075, 0.02]} castShadow>
              <sphereGeometry args={[0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshStandardMaterial color={hair} roughness={0.95} />
            </mesh>
            {[-1, 1].map((side) => (
              <React.Fragment key={side}>
                <mesh position={[side * 0.205, -0.015, 0]}>
                  <sphereGeometry args={[0.052, 12, 12]} />
                  <meshStandardMaterial color={skin} roughness={0.9} />
                </mesh>
                <mesh position={[side * 0.075, 0.012, 0.166]}>
                  <sphereGeometry args={[0.027, 12, 12]} />
                  <meshStandardMaterial color="#fff" roughness={0.55} />
                </mesh>
                <mesh position={[side * 0.075, 0.012, 0.188]}>
                  <sphereGeometry args={[0.012, 10, 10]} />
                  <meshStandardMaterial color="#382d35" roughness={0.65} />
                </mesh>
                <mesh position={[side * 0.075, 0.054, 0.16]} rotation={[0, 0, side * -0.08]}>
                  <capsuleGeometry args={[0.012, 0.055, 3, 8]} />
                  <meshStandardMaterial color={hair} roughness={0.95} />
                </mesh>
              </React.Fragment>
            ))}
            <mesh position={[0, -0.04, 0.215]} scale={[0.8, 1, 1.2]} castShadow>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color={skin} roughness={0.88} />
            </mesh>
            <mesh position={[0, -0.105, 0.174]}>
              <capsuleGeometry args={[0.008, 0.035, 3, 8]} />
              <meshStandardMaterial color="#825c5a" roughness={0.85} />
            </mesh>
          </group>
          {[-1, 1].map((side) => {
            const armRef = side < 0 ? refs.leftArm : refs.rightArm;
            const elbowRef = side < 0 ? refs.leftElbow : refs.rightElbow;
            const thighRef = side < 0 ? refs.leftLeg : refs.rightLeg;
            const shinRef = side < 0 ? refs.leftShin : refs.rightShin;
            const armAngle = seated && reaching && side < 0 ? -0.72 : side * 0.08;

            return (
              <React.Fragment key={side}>
                <group ref={armRef} position={[side * 0.22, seated ? 1.2 : 1.43, 0]} rotation={[0, 0, armAngle]}>
                  <mesh position={[0, -0.17, 0]} castShadow>
                    <capsuleGeometry args={[0.095, 0.28, 6, 12]} />
                    <meshStandardMaterial color={garment} roughness={0.84} />
                  </mesh>
                  <mesh position={[0, -0.36, 0]} castShadow>
                    <sphereGeometry args={[0.083, 14, 14]} />
                    <meshStandardMaterial color={skin} roughness={0.9} />
                  </mesh>
                  <group
                    ref={elbowRef}
                    position={[0, -0.36, 0]}
                    rotation={[0, 0, seated && reaching && side < 0 ? 0.85 : 0]}
                  >
                    <mesh position={[0, -0.17, 0.01]} castShadow>
                      <capsuleGeometry args={[0.075, 0.28, 6, 12]} />
                      <meshStandardMaterial color={skin} roughness={0.9} />
                    </mesh>
                    <mesh position={[0, -0.34, 0.025]} castShadow>
                      <sphereGeometry args={[0.073, 14, 14]} />
                      <meshStandardMaterial color={skin} roughness={0.9} />
                    </mesh>
                    {[-1, -0.33, 0.33, 1].map((finger) => (
                      <mesh
                        key={finger}
                        position={[finger * 0.033, -0.4, 0.04]}
                        rotation={[0, 0, finger * 0.12]}
                      >
                        <capsuleGeometry args={[0.012, 0.055, 3, 7]} />
                        <meshStandardMaterial color={skin} roughness={0.9} />
                      </mesh>
                    ))}
                  </group>
                </group>
                <group
                  ref={thighRef}
                  position={[side * 0.12, seated ? 0.69 : 0.62, seated ? 0.02 : 0]}
                  rotation={[seated ? Math.PI / 2 : 0, 0, seated ? side * 0.08 : 0]}
                >
                  <mesh position={[0, -0.18, 0]} castShadow>
                    <capsuleGeometry args={[0.105, 0.27, 6, 12]} />
                    <meshStandardMaterial color={seated ? garment : '#403744'} roughness={0.88} />
                  </mesh>
                  <mesh position={[0, -0.36, 0]} castShadow>
                    <sphereGeometry args={[0.09, 14, 14]} />
                    <meshStandardMaterial color="#403744" roughness={0.9} />
                  </mesh>
                  <group
                    ref={shinRef}
                    position={[0, -0.36, 0]}
                    rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}
                  >
                    <mesh position={[0, -0.19, 0]} castShadow>
                      <capsuleGeometry args={[0.078, 0.28, 6, 12]} />
                      <meshStandardMaterial color="#403744" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, -0.36, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                      <capsuleGeometry args={[0.07, 0.14, 5, 10]} />
                      <meshStandardMaterial color="#302a34" roughness={0.78} />
                    </mesh>
                  </group>
                </group>
              </React.Fragment>
            );
          })}
        </>
      )}
    </group>
  );
}

function RoomShell({ reception = false, ward = false }) {
  return (
    <group>
      <Block position={[0, -0.14, 0]} size={[11, 0.28, 7]} color={ward ? '#cbd3d1' : '#ded9e3'} />
      <Block position={[0, 2.9, -3.48]} size={[11, 5.8, 0.16]} color={ward ? '#e5ece9' : '#f0edf3'} />
      <Block position={[-5.42, 2.7, 0]} size={[0.16, 5.4, 7]} color={ward ? '#dbe4e0' : '#e8e4eb'} />
      <Block position={[0, 5.65, 0]} size={[11, 0.14, 7]} color="#ece8ef" />
      <Block position={[0, 0.045, -3.36]} size={[11, 0.16, 0.1]} color={ward ? '#b7c8c2' : '#e8e4eb'} />
      <Block position={[-5.31, 0.045, 0]} size={[0.1, 0.16, 7]} color={ward ? '#b7c8c2' : '#e8e4eb'} />
      <Block position={[3.55, 2.15, -3.36]} size={[2.75, 2.75, 0.08]} color={ward ? '#b8d3d9' : '#dce8f0'} roughness={0.28} />
      <Block position={[2.18, 2.15, -3.3]} size={[0.055, 2.82, 0.06]} color="#fff" />
      <Block position={[3.55, 2.15, -3.3]} size={[0.055, 2.82, 0.06]} color="#fff" />
      <Block position={[4.92, 2.15, -3.3]} size={[0.055, 2.82, 0.06]} color="#fff" />
      <Block position={[3.55, 0.77, -3.3]} size={[2.8, 0.055, 0.06]} color="#fff" />
      <Block position={[3.55, 3.53, -3.3]} size={[2.8, 0.055, 0.06]} color="#fff" />
      {ward && (
        <>
          <Block position={[3.55, 2.15, -3.27]} size={[2.65, 0.035, 0.025]} color="#e9f4f3" />
          <Block position={[3.55, 0.7, -3.23]} size={[2.95, 0.12, 0.16]} color="#f3f5f2" />
          <Block position={[-1.45, 1.75, -3.31]} size={[2.15, 0.16, 0.12]} color="#b4c5bf" />
          <Block position={[-1.45, 1.62, -3.31]} size={[2.15, 0.045, 0.12]} color="#f5f6f2" />
          <Block position={[-4.45, 2.3, -3.27]} size={[0.8, 0.42, 0.035]} color="#d5e0dc" />
          <Block position={[-4.45, 2.3, -3.23]} size={[0.68, 0.08, 0.025]} color="#fff" />
          <Block position={[-4.45, 2.15, -3.23]} size={[0.5, 0.025, 0.025]} color="#aebdb7" />
        </>
      )}
      {!ward && (
        <>
          <Block position={[-4.45, 2.3, -3.36]} size={[1.3, 0.82, 0.1]} color="#ebe6ee" />
          <Block position={[-4.45, 2.35, -3.27]} size={[0.9, 0.035, 0.02]} color="#b9afc0" />
          <Block position={[-4.45, 2.13, -3.27]} size={[0.65, 0.035, 0.02]} color="#c9bfce" />
        </>
      )}
      <Block position={[-3.4, 4.95, -3.15]} size={[0.18, 0.08, 0.14]} color="#fff5df" roughness={0.3} />
      {reception && (
        <>
          <Block position={[1.6, 1.03, -1.72]} size={[3.55, 0.2, 1.05]} color="#ded8e5" />
          <Block position={[1.6, 0.53, -1.72]} size={[3.18, 0.88, 0.82]} color="#f7f4f8" />
          <Block position={[1.6, 1.19, -1.72]} size={[3.65, 0.12, 1.14]} color="#fff" />
          <Block position={[2.6, 1.52, -2.05]} size={[0.78, 0.42, 0.08]} color="#665476" />
        </>
      )}
    </group>
  );
}

function Bed() {
  return (
    <group>
      <Block position={[-1.1, 0.35, 0]} size={[2.85, 0.12, 1.3]} color="#89969a" />
      <Block position={[-1.1, 0.48, 0]} size={[3.12, 0.2, 1.5]} color="#d4d9d8" />
      <Block position={[-1.1, 0.62, 0]} size={[3.05, 0.16, 1.42]} color="#f7f8f5" />
      <Block position={[0.47, 0.98, 0]} size={[0.14, 0.83, 1.48]} color="#dbe1df" />
      <Block position={[-0.72, 0.79, 0]} size={[0.72, 0.17, 1.08]} color="#f0f3f1" />
      <Block position={[-1.95, 0.99, 0]} size={[1.25, 0.18, 1.24]} color="#d8e2df" />
      <Block position={[-1.95, 1.09, 0]} size={[1.12, 0.025, 1.12]} color="#e8eeeb" />
      {[-1, 1].map((side) => (
        <React.Fragment key={side}>
          <Block position={[-1.1, 0.86, side * 0.69]} size={[2.08, 0.075, 0.07]} color="#aab8b6" />
          <Block position={[-2.11, 0.72, side * 0.69]} size={[0.07, 0.35, 0.07]} color="#aab8b6" />
          <Block position={[-0.09, 0.72, side * 0.69]} size={[0.07, 0.35, 0.07]} color="#aab8b6" />
          {[-2.28, 0.08].map((x) => (
            <React.Fragment key={x}>
              <Block position={[x, 0.16, side * 0.52]} size={[0.1, 0.38, 0.1]} color="#909da0" />
              <mesh position={[x, 0.075, side * 0.52]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.075, 0.025, 8, 16]} />
                <meshStandardMaterial color="#5e6a6d" metalness={0.35} roughness={0.48} />
              </mesh>
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </group>
  );
}

function WardEquipment() {
  return (
    <group>
      <Block position={[1.15, 0.47, 0.8]} size={[0.7, 0.66, 0.64]} color="#e5e9e5" />
      <Block position={[1.15, 0.83, 0.8]} size={[0.76, 0.1, 0.7]} color="#f8f8f4" />
      {[-1, 1].map((side) => (
        <React.Fragment key={side}>
          <Block position={[1.15, 0.44 + side * 0.15, 1.13]} size={[0.54, 0.025, 0.025]} color="#c2cbc7" />
          <Block position={[1.15, 0.44 + side * 0.15, 1.15]} size={[0.1, 0.045, 0.025]} color="#a6b3ae" />
        </React.Fragment>
      ))}
      <Block position={[-3.55, 0.1, 0.12]} size={[0.55, 0.055, 0.055]} color="#8c9a9b" />
      <Block position={[-3.55, 0.1, 0.12]} size={[0.055, 0.055, 0.55]} color="#8c9a9b" />
      {[-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => (
        <mesh key={`${xSide}-${zSide}`} position={[-3.55 + xSide * 0.24, 0.075, 0.12 + zSide * 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.055, 0.018, 8, 16]} />
          <meshStandardMaterial color="#59686b" metalness={0.3} roughness={0.5} />
        </mesh>
      )))}
      <mesh position={[-3.55, 1.58, 0.12]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 2.95, 12]} />
        <meshStandardMaterial color="#879597" metalness={0.48} roughness={0.4} />
      </mesh>
      <mesh position={[-3.55, 3.06, 0.12]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.55, 10]} />
        <meshStandardMaterial color="#879597" metalness={0.48} roughness={0.4} />
      </mesh>
      <mesh position={[-3.55, 2.81, 0.12]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#c5e1e3" transparent opacity={0.78} roughness={0.24} />
      </mesh>
      <Block position={[-3.55, 2.81, 0.12]} size={[0.08, 0.18, 0.025]} color="#e7f2ef" />
      <Block position={[-3.55, 1.86, 0.12]} size={[0.68, 0.48, 0.22]} color="#f1f3ef" />
      <Block position={[-3.55, 1.86, 0.24]} size={[0.5, 0.3, 0.025]} color="#34464b" />
      {[-1, 1].map((side) => (
        <Block key={side} position={[-3.55 + side * 0.12, 1.88, 0.258]} size={[0.04, 0.035, 0.015]} color="#91cab5" />
      ))}
      <Block position={[1.15, 1.42, 0.8]} size={[0.78, 0.66, 0.14]} color="#f1f3ef" />
      <Block position={[1.15, 1.42, 0.89]} size={[0.62, 0.48, 0.035]} color="#34464b" />
      <Block position={[1.15, 1.44, 0.916]} size={[0.42, 0.025, 0.018]} color="#91cab5" />
      <Block position={[1.15, 1.39, 0.916]} size={[0.22, 0.018, 0.018]} color="#91cab5" />
    </group>
  );
}

function Paper({ position, rotation = [0, 0, 0], title, accent = '#8e62ae' }) {
  return (
    <group position={position} rotation={rotation}>
      <Block position={[0, 0, 0]} size={[0.82, 1.04, 0.04]} color="#fff" />
      <Block position={[0, 0.31, 0.025]} size={[0.46, 0.045, 0.015]} color={accent} />
      <Block position={[-0.015, 0.13, 0.025]} size={[0.57, 0.025, 0.015]} color="#c9bfce" />
      <Block position={[0.035, -0.02, 0.025]} size={[0.46, 0.025, 0.015]} color="#d7d0dd" />
      <Block position={[-0.07, -0.17, 0.025]} size={[0.35, 0.025, 0.015]} color="#d7d0dd" />
      {title && (
        <Html position={[0, 0.44, 0.04]} center distanceFactor={7} transform>
          <div className="document-label scene-html scene-html-paperwork">{title}</div>
        </Html>
      )}
    </group>
  );
}

function SceneCard({ position, title, detail, scene, icon = '✓', muted = false }) {
  const viewportWidth = useThree((state) => state.viewport.width);
  const isCompact = viewportWidth < 8;
  const distanceFactor = isCompact ? 3.5 : 6;
  const cardPosition = isCompact
    ? [position[0] * 0.65 - 0.5, position[1], position[2]]
    : position;

  return (
    <group position={cardPosition}>
      <Block position={[0, 0, 0]} size={[1.85, 1.3, 0.08]} color={muted ? '#f5f2f7' : '#fff'} />
      <Html position={[0, 0, 0.055]} center transform distanceFactor={distanceFactor} occlude={false}>
        <div className={`scene-card scene-html scene-html-${scene}${muted ? ' scene-card-muted' : ''}`}>
          <span className="scene-card-icon">{icon}</span>
          <strong>{title}</strong>
          <small>{detail}</small>
        </div>
      </Html>
    </group>
  );
}

function SceneContent({ sceneRefs }) {
  const camera = useThree((state) => state.camera);
  const cameraTarget = useRef(new THREE.Vector3(0, 1.25, 0));

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const keys = ['ward', 'reception', 'paperwork', 'clarity', 'support', 'checklist', 'together'];
    const scenes = Object.fromEntries(keys.map((key) => [key, sceneRefs[key].current]));
    const caregiver = sceneRefs.caregiver.current;
    const humans = sceneRefs.humans;
    const chapters = gsap.utils.toArray('.chapter');
    if (keys.some((key) => !scenes[key]) || !caregiver || !humans || chapters.length !== keys.length) return undefined;

    const waypoints = [
      { key: 'ward', start: 0, end: 0.155, camera: [0.25, 3.7, 8.8], target: [-0.55, 1.15, 0] },
      { key: 'reception', start: 0.17, end: 0.295, camera: [1.4, 4.1, 10.2], target: [1.35, 1.2, -0.7] },
      { key: 'paperwork', start: 0.31, end: 0.43, camera: [0, 4.2, 9.5], target: [0, 1.4, 0] },
      { key: 'clarity', start: 0.445, end: 0.56, camera: [0, 4.0, 10.4], target: [0, 1.25, 0] },
      { key: 'support', start: 0.575, end: 0.705, camera: [0.2, 4.1, 10.5], target: [0, 1.35, 0] },
      { key: 'checklist', start: 0.72, end: 0.855, camera: [-0.2, 4.1, 10.4], target: [0, 1.25, 0] },
      { key: 'together', start: 0.87, end: 1, camera: [0, 4.3, 10.8], target: [0, 1.25, 0] },
    ];

    let context;
    let frameId;
    const initializeTimeline = () => {
      const activeRigs = [
        humans.caregiverWard,
        humans.caregiverReception,
        humans.staff,
        humans.paperwork,
        humans.clarity,
        humans.support,
        humans.therapist,
        humans.finalCaregiver,
      ];
      const rigsReady = activeRigs.every((rig) => Object.values(rig).every((part) => part.current));
      if (document.querySelectorAll('.scene-html').length < 15 || !rigsReady) {
        frameId = requestAnimationFrame(initializeTimeline);
        return;
      }

      context = gsap.context(() => {
        keys.slice(1).forEach((key) => {
          gsap.set(scenes[key].scale, { x: 0.001, y: 0.001, z: 0.001 });
        });
        gsap.set(chapters.slice(1), { autoAlpha: 0 });
        gsap.set('.scene-html', { autoAlpha: 0 });

        const overlays = Object.fromEntries(
          keys.map((key) => [key, gsap.utils.toArray(`.scene-html-${key}`)]),
        );
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: '.story-section',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        const animateHuman = (human, property, values, start, duration) => {
          const target = human?.[property]?.current;
          if (target) timeline.to(target.rotation, { ...values, duration, ease: 'power1.inOut' }, start);
        };
        const patientTorso = humans.patient.torso.current;
        const caregiverWardTorso = humans.caregiverWard.torso.current;
        const caregiverReception = humans.caregiverReception;
        const therapist = humans.therapist;
        const finalCaregiver = humans.finalCaregiver;

        if (patientTorso && caregiverWardTorso) {
          timeline.to(patientTorso.scale, { y: 1.025, duration: 0.045, ease: 'sine.inOut' }, 0.025)
            .to(patientTorso.scale, { y: 1, duration: 0.045, ease: 'sine.inOut' }, 0.07)
            .to(patientTorso.scale, { y: 1.025, duration: 0.045, ease: 'sine.inOut' }, 0.115)
            .to(caregiverWardTorso.rotation, { x: -0.08, duration: 0.06, ease: 'sine.inOut' }, 0.035);
        }
        animateHuman(humans.caregiverWard, 'head', { z: 0.12, x: -0.06 }, 0.04, 0.06);
        animateHuman(humans.caregiverWard, 'leftArm', { z: -0.88, x: -0.08 }, 0.035, 0.07);
        animateHuman(humans.caregiverWard, 'leftElbow', { z: 0.6 }, 0.04, 0.07);

        if (caregiverReception) {
          gsap.set(caregiver.position, { x: -3, y: 0, z: 0.5 });
          gsap.set(caregiver.rotation, { y: Math.PI / 2 });
          timeline.to(caregiver.position, {
            x: 1.05, duration: 0.082, ease: 'power1.inOut',
          }, 0.19);
          for (let step = 0; step < 6; step += 1) {
            const at = 0.19 + step * 0.013;
            const swing = step % 2 === 0 ? 0.42 : -0.42;
            timeline.to(humans.caregiverReception.leftLeg.current.rotation, {
              x: swing, duration: 0.013, ease: 'none',
            }, at);
            timeline.to(humans.caregiverReception.rightLeg.current.rotation, {
              x: -swing, duration: 0.013, ease: 'none',
            }, at);
            timeline.to(humans.caregiverReception.leftArm.current.rotation, {
              x: -swing * 0.65, duration: 0.013, ease: 'none',
            }, at);
            timeline.to(humans.caregiverReception.rightArm.current.rotation, {
              x: swing * 0.65, duration: 0.013, ease: 'none',
            }, at);
            timeline.to(caregiver.position, {
              y: step % 2 === 0 ? 0.035 : 0, duration: 0.013, ease: 'none',
            }, at);
          }
          [humans.caregiverReception.leftLeg, humans.caregiverReception.rightLeg,
            humans.caregiverReception.leftArm, humans.caregiverReception.rightArm].forEach((part) => {
            timeline.to(part.current.rotation, { x: 0, duration: 0.012, ease: 'power1.out' }, 0.27);
          });
          timeline.to(caregiver.position, { y: 0, duration: 0.012 }, 0.27);
          animateHuman(humans.caregiverReception, 'rightArm', { z: -0.42, x: -0.15 }, 0.278, 0.02);
          animateHuman(humans.caregiverReception, 'rightElbow', { z: 0.62 }, 0.28, 0.02);
          animateHuman(humans.caregiverReception, 'head', { y: -0.18, x: -0.04 }, 0.28, 0.025);
          animateHuman(humans.staff, 'head', { y: 0.2 }, 0.285, 0.02);
          animateHuman(humans.staff, 'leftArm', { z: -0.32 }, 0.285, 0.025);
          animateHuman(humans.staff, 'leftElbow', { z: 0.45 }, 0.285, 0.025);
        }

        animateHuman(humans.paperwork, 'head', { z: -0.22, x: 0.1 }, 0.335, 0.035);
        animateHuman(humans.paperwork, 'leftArm', { z: -1.02, x: 0.15 }, 0.34, 0.04);
        animateHuman(humans.paperwork, 'rightArm', { z: 0.95, x: -0.12 }, 0.34, 0.04);
        animateHuman(humans.paperwork, 'leftElbow', { z: 0.72 }, 0.345, 0.035);
        animateHuman(humans.paperwork, 'rightElbow', { z: -0.68 }, 0.345, 0.035);
        animateHuman(humans.paperwork, 'torso', { z: -0.045 }, 0.35, 0.035);

        animateHuman(humans.clarity, 'head', { y: 0.16, z: 0 }, 0.47, 0.06);
        animateHuman(humans.clarity, 'leftArm', { z: -0.42 }, 0.48, 0.055);
        animateHuman(humans.clarity, 'rightArm', { z: 0.42 }, 0.48, 0.055);

        animateHuman(humans.support, 'head', { y: 0.18 }, 0.6, 0.035);
        animateHuman(humans.support, 'rightArm', { z: 0.55, x: -0.22 }, 0.6, 0.04);
        animateHuman(humans.support, 'rightElbow', { z: -0.48 }, 0.61, 0.04);
        animateHuman(therapist, 'head', { x: -0.08 }, 0.75, 0.04);
        animateHuman(therapist, 'leftArm', { z: -0.56 }, 0.75, 0.04);
        animateHuman(therapist, 'leftElbow', { z: 0.66 }, 0.76, 0.04);
        animateHuman(therapist, 'rightArm', { z: 0.32 }, 0.78, 0.035);

        if (finalCaregiver) {
          timeline.to(finalCaregiver.torso.current.rotation, {
            z: -0.08, duration: 0.04, ease: 'sine.inOut',
          }, 0.9);
          timeline.to(finalCaregiver.head.current.rotation, {
            z: 0.12, duration: 0.05, ease: 'sine.inOut',
          }, 0.91);
          timeline.to(finalCaregiver.leftArm.current.rotation, {
            z: -0.92, duration: 0.05, ease: 'sine.inOut',
          }, 0.9);
          timeline.to(finalCaregiver.leftElbow.current.rotation, {
            z: 0.7, duration: 0.05, ease: 'sine.inOut',
          }, 0.9);
        }

        waypoints.forEach((point, index) => {
          if (index > 0) {
            const previous = waypoints[index - 1];
            if (overlays[previous.key].length) {
              timeline.to(overlays[previous.key], {
                autoAlpha: 0, duration: 0.01,
              }, point.start - 0.006);
            }
            timeline.to(overlays[point.key], {
              autoAlpha: 1, duration: 0.01,
            }, point.start + 0.018);
            timeline.to(chapters[index - 1], {
              autoAlpha: 0, y: -10, duration: 0.015, ease: 'power1.in',
            }, point.start - 0.006);
            timeline.fromTo(chapters[index], {
              autoAlpha: 0, y: 14,
            }, {
              autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out',
            }, point.start + 0.018);
            timeline.to(scenes[previous.key].scale, {
              x: 0.001, y: 0.001, z: 0.001, duration: 0.022, ease: 'power1.in',
            }, point.start - 0.006);
            timeline.to(scenes[point.key].scale, {
              x: 1, y: 1, z: 1, duration: 0.025, ease: 'power2.out',
            }, point.start + 0.018);
          }

          const next = waypoints[index + 1];
          if (next) {
            timeline.to(camera.position, {
              x: next.camera[0],
              y: next.camera[1],
              z: next.camera[2],
              duration: next.start - point.start,
              ease: 'none',
              onUpdate: () => camera.lookAt(cameraTarget.current),
            }, point.start);
            timeline.to(cameraTarget.current, {
              x: next.target[0],
              y: next.target[1],
              z: next.target[2],
              duration: next.start - point.start,
              ease: 'none',
              onUpdate: () => camera.lookAt(cameraTarget.current),
            }, point.start);
          }
        });

        const finalScene = waypoints[waypoints.length - 1];
        timeline.to(camera.position, {
          x: finalScene.camera[0],
          y: finalScene.camera[1],
          z: finalScene.camera[2],
          duration: 1 - finalScene.start,
          ease: 'none',
          onUpdate: () => camera.lookAt(cameraTarget.current),
        }, finalScene.start);
      });
    };

    frameId = requestAnimationFrame(initializeTimeline);
    return () => {
      cancelAnimationFrame(frameId);
      context?.revert();
    };
  }, [camera, sceneRefs]);

  return (
    <>
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#f5fbf8', '#b9c9c4', 0.58]} />
      <directionalLight
        position={[-3, 8, 5]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={22}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      <group ref={sceneRefs.ward}>
        <RoomShell ward />
        <Bed />
        <Person position={[-1.12, 0, 0]} shirt="#a98dbb" lying motionRefs={sceneRefs.humans.patient} />
        <group position={[0.15, 0, 0.95]} rotation={[0, -2.3, 0]}>
          <Block position={[0, 0.57, 0]} size={[0.72, 0.12, 0.72]} color="#87938f" />
          <Block position={[0, 0.95, -0.32]} size={[0.72, 0.72, 0.1]} color="#87938f" />
          {[-1, 1].flatMap((side) => [-1, 1].map((depth) => (
            <Block key={`${side}-${depth}`} position={[side * 0.27, 0.29, depth * 0.27]} size={[0.07, 0.5, 0.07]} color="#7a8784" />
          )))}
          <Person position={[0, 0, 0]} shirt="#72508e" seated reaching motionRefs={sceneRefs.humans.caregiverWard} />
        </group>
        <WardEquipment />
      </group>

      <group ref={sceneRefs.reception} scale={0.001}>
        <RoomShell reception />
        <group ref={sceneRefs.caregiver} position={[-3, 0, 0.5]}>
          <Person position={[0, 0, 0]} shirt="#72508e" motionRefs={sceneRefs.humans.caregiverReception} />
        </group>
        <Person position={[2.4, 0, -2.1]} shirt="#e7e3eb" coat motionRefs={sceneRefs.humans.staff} />
        <Block position={[2.35, 1.55, -2.08]} size={[0.8, 0.48, 0.08]} color="#302a35" />
        <Person position={[3.3, 0, 1.2]} shirt="#aa93b8" seated />
        <Block position={[2.55, 0.5, 1.35]} size={[2.0, 0.65, 0.68]} color="#ddd7e2" />
        <Person position={[4.15, 0, 1.2]} shirt="#d6b38d" seated />
        <Block position={[-2.75, 0.54, -0.42]} size={[0.6, 0.12, 0.62]} color="#e0dae4" />
        <Html position={[0.95, 2.65, -1.15]} center distanceFactor={8}>
          <div className="scene-note scene-html scene-html-reception">Where can we find financial help?</div>
        </Html>
      </group>

      <group ref={sceneRefs.paperwork} scale={0.001}>
        <RoomShell />
        <Person position={[0, 0, 0.72]} shirt="#72508e" motionRefs={sceneRefs.humans.paperwork} />
        <Paper position={[-1.85, 2.18, 0]} rotation={[0, 0.2, -0.12]} title="MEDICAL BILL" />
        <Paper position={[-0.68, 2.65, -0.5]} rotation={[0, -0.18, 0.13]} title="SCHEME FORM" accent="#7751a0" />
        <Paper position={[0.65, 2.48, -0.18]} rotation={[0, 0.16, -0.16]} title="INSURANCE" accent="#9d78b5" />
        <Paper position={[1.9, 2.12, 0.12]} rotation={[0, -0.12, 0.12]} title="ELIGIBILITY" accent="#79518f" />
        <Paper position={[-1.5, 1.15, -0.8]} rotation={[0, 0.1, 0.08]} title="DOCUMENTS" accent="#b18acb" />
        <Html position={[0, 3.42, -0.3]} center distanceFactor={8}>
          <div className="confusion-word scene-html scene-html-paperwork">Too many forms. No clear next step.</div>
        </Html>
      </group>

      <group ref={sceneRefs.clarity} scale={0.001}>
        <Block position={[0, -0.13, 0]} size={[10, 0.26, 7]} color="#f1edf4" />
        <Block position={[0, 2.4, -3.4]} size={[10, 4.8, 0.14]} color="#fbf9fc" />
        <Person position={[-2.3, 0, 0.55]} shirt="#72508e" motionRefs={sceneRefs.humans.clarity} />
        <mesh position={[0.3, 1.55, -0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[1.5, 0.055, 12, 100, Math.PI * 1.35]} />
          <meshStandardMaterial color="#a56cc5" emissive="#74449a" emissiveIntensity={0.2} />
        </mesh>
        <Block position={[1.95, 1.42, -0.45]} size={[1.68, 1.05, 0.1]} color="#fff" />
        <Html position={[1.95, 1.42, -0.37]} center transform distanceFactor={7}>
          <div className="clarity-board scene-html scene-html-clarity"><small>ONE CLEARER JOURNEY</small><strong>NERAVU</strong><span>Support at every step.</span></div>
        </Html>
        <mesh position={[0.2, 0.2, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.75, 0.035, 10, 100]} />
          <meshBasicMaterial color="#c4a4d5" transparent opacity={0.72} />
        </mesh>
      </group>

      <group ref={sceneRefs.support} scale={0.001}>
        <Block position={[0, -0.13, 0]} size={[10, 0.26, 7]} color="#f1edf4" />
        <Block position={[0, 2.45, -3.4]} size={[10, 4.9, 0.14]} color="#fbf9fc" />
        <Person position={[-2.7, 0, 0.6]} shirt="#72508e" motionRefs={sceneRefs.humans.support} />
        <SceneCard scene="support" position={[-1.45, 2.35, -0.55]} title="GOVERNMENT SCHEMES" detail="Explore possible assistance" />
        <SceneCard scene="support" position={[0.55, 2.35, -0.55]} title="INSURANCE BENEFITS" detail="Understand coverage" />
        <SceneCard scene="support" position={[2.55, 2.35, -0.55]} title="CHARITABLE SUPPORT" detail="Find trusted programmes" />
        <mesh position={[0.9, 0.1, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.35, 0.035, 10, 100]} />
          <meshBasicMaterial color="#a876c4" transparent opacity={0.68} />
        </mesh>
      </group>

      <group ref={sceneRefs.checklist} scale={0.001}>
        <Block position={[0, -0.13, 0]} size={[10, 0.26, 7]} color="#f1edf4" />
        <Block position={[0, 2.45, -3.4]} size={[10, 4.9, 0.14]} color="#fbf9fc" />
        <Person position={[-2.65, 0, 0.55]} shirt="#72508e" />
        <SceneCard scene="checklist" position={[-1.25, 2.1, -0.5]} title="CHECK ELIGIBILITY" detail="Understand what may apply" icon="01" />
        <SceneCard scene="checklist" position={[0.8, 2.1, -0.5]} title="GATHER DOCUMENTS" detail="A checklist made for you" icon="02" />
        <SceneCard scene="checklist" position={[2.85, 2.1, -0.5]} title="TALK TO A PERSON" detail="Verified human guidance" icon="03" muted />
        <Block position={[0.2, 0.92, 0.7]} size={[2.35, 0.08, 0.9]} color="#dcd4e3" />
        <Person position={[0.95, 0.92, 0.65]} shirt="#795792" coat motionRefs={sceneRefs.humans.therapist} />
      </group>

      <group ref={sceneRefs.together} scale={0.001}>
        <RoomShell />
        <Bed />
        <Person position={[-1.12, 0, 0]} shirt="#a98dbb" lying motionRefs={sceneRefs.humans.finalPatient} />
        <Block position={[-0.4, 1.18, 0]} size={[0.95, 0.12, 1.28]} color="#eee8f3" />
        <Person position={[0.45, 0, 1.05]} shirt="#72508e" seated reaching motionRefs={sceneRefs.humans.finalCaregiver} />
        <Block position={[0.45, 0.54, 1.05]} size={[0.62, 0.12, 0.62]} color="#c9bfd2" />
        <Block position={[2.72, 1.12, -1.5]} size={[1.9, 1.6, 0.12]} color="#e5d9ef" />
        <Html position={[2.72, 1.22, -1.42]} center transform distanceFactor={7}>
          <div className="closing-board scene-html scene-html-together"><small>CARE, WITH CLARITY</small><strong>NERAVU</strong><span>Support at every step.</span></div>
        </Html>
        <mesh position={[0.3, 0.09, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.15, 0.035, 10, 100]} />
          <meshBasicMaterial color="#ae7bc8" transparent opacity={0.7} />
        </mesh>
      </group>

      <ContactShadows position={[0, -0.005, 0]} opacity={0.2} scale={13} blur={2.8} far={5} />
    </>
  );
}

export default function HospitalScene() {
  const sceneRefs = useRef({
    ward: React.createRef(),
    reception: React.createRef(),
    caregiver: React.createRef(),
    paperwork: React.createRef(),
    clarity: React.createRef(),
    support: React.createRef(),
    checklist: React.createRef(),
    together: React.createRef(),
    humans: {
      patient: createHumanMotionRefs(),
      caregiverWard: createHumanMotionRefs(),
      caregiverReception: createHumanMotionRefs(),
      staff: createHumanMotionRefs(),
      paperwork: createHumanMotionRefs(),
      clarity: createHumanMotionRefs(),
      support: createHumanMotionRefs(),
      therapist: createHumanMotionRefs(),
      finalPatient: createHumanMotionRefs(),
      finalCaregiver: createHumanMotionRefs(),
    },
  }).current;

  return (
    <div className="canvas-wrap">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0.25, 3.7, 8.8], fov: 36 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#f8f6fa']} />
        <SceneContent sceneRefs={sceneRefs} />
        <Environment preset="studio" environmentIntensity={0.3} />
      </Canvas>
    </div>
  );
}
