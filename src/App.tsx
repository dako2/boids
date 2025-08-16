import { useEffect, useRef, useState } from 'react'
import './App.css'

interface Boid {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  maxSpeed: number
  maxForce: number
  followingLeader: number | null
}

interface LeaderBird {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
  color: string
  autonomous: boolean
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const boidsRef = useRef<Boid[]>([])
  const leadersRef = useRef<LeaderBird[]>([
    { id: 0, x: 400, y: 300, vx: 0, vy: 0, targetX: 400, targetY: 300, color: '#f59e0b', autonomous: false },
    { id: 1, x: 800, y: 500, vx: 0, vy: 0, targetX: 800, targetY: 500, color: '#10b981', autonomous: true },
    { id: 2, x: 600, y: 200, vx: 0, vy: 0, targetX: 600, targetY: 200, color: '#8b5cf6', autonomous: true }
  ])
  const [isRunning, setIsRunning] = useState(true)
  const [boidCount, setBoidCount] = useState(120)
  const [leaderInfluence, setLeaderInfluence] = useState(1.2)
  const [numLeaders, setNumLeaders] = useState(3)
  const [mouseControlledLeader, setMouseControlledLeader] = useState(0)
  const [separationWeight, setSeparationWeight] = useState(2.0)
  const [alignmentWeight, setAlignmentWeight] = useState(1.0)
  const [cohesionWeight, setCohesionWeight] = useState(1.0)
  const [separationRadius, setSeparationRadius] = useState(30)
  const [alignmentRadius, setAlignmentRadius] = useState(60)
  const [cohesionRadius, setCohesionRadius] = useState(60)

  const CANVAS_WIDTH = 1200
  const CANVAS_HEIGHT = 800
  const MIN_SPEED = 1.5
  const MAX_SPEED = 3.5
  const LEADER_MAX_SPEED = 4
  const LEADER_FOLLOW_RADIUS = 120
  const EDGE_MARGIN = 80

  const initializeBoids = (count: number) => {
    const boids: Boid[] = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
      boids.push({
        x: EDGE_MARGIN + Math.random() * (CANVAS_WIDTH - 2 * EDGE_MARGIN),
        y: EDGE_MARGIN + Math.random() * (CANVAS_HEIGHT - 2 * EDGE_MARGIN),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: angle,
        maxSpeed: speed,
        maxForce: 0.15 + Math.random() * 0.1,
        followingLeader: null,
      })
    }
    boidsRef.current = boids
  }

  const distance = (boid1: Boid, boid2: Boid) => {
    return Math.sqrt((boid1.x - boid2.x) ** 2 + (boid1.y - boid2.y) ** 2)
  }

  const distanceToLeader = (boid: Boid, leader: LeaderBird) => {
    return Math.sqrt((boid.x - leader.x) ** 2 + (boid.y - leader.y) ** 2)
  }

  const separation = (boid: Boid, boids: Boid[]) => {
    let steerX = 0
    let steerY = 0
    let count = 0

    for (const other of boids) {
      const d = distance(boid, other)
      if (d > 0 && d < separationRadius) {
        const diffX = boid.x - other.x
        const diffY = boid.y - other.y
        const weight = 1 / (d * d)
        steerX += (diffX / d) * weight
        steerY += (diffY / d) * weight
        count++
      }
    }

    if (count > 0) {
      steerX /= count
      steerY /= count
      return limitForce({ x: steerX, y: steerY }, boid.maxForce)
    }

    return { x: 0, y: 0 }
  }

  const alignment = (boid: Boid, boids: Boid[]) => {
    let avgVx = 0
    let avgVy = 0
    let count = 0

    for (const other of boids) {
      const d = distance(boid, other)
      if (d > 0 && d < alignmentRadius) {
        avgVx += other.vx
        avgVy += other.vy
        count++
      }
    }

    if (count > 0) {
      avgVx /= count
      avgVy /= count
      const magnitude = Math.sqrt(avgVx ** 2 + avgVy ** 2)
      if (magnitude > 0) {
        avgVx = (avgVx / magnitude) * boid.maxSpeed
        avgVy = (avgVy / magnitude) * boid.maxSpeed
      }
      const steer = { x: avgVx - boid.vx, y: avgVy - boid.vy }
      return limitForce(steer, boid.maxForce)
    }

    return { x: 0, y: 0 }
  }

  const cohesion = (boid: Boid, boids: Boid[]) => {
    let centerX = 0
    let centerY = 0
    let count = 0

    for (const other of boids) {
      const d = distance(boid, other)
      if (d > 0 && d < cohesionRadius) {
        centerX += other.x
        centerY += other.y
        count++
      }
    }

    if (count > 0) {
      centerX /= count
      centerY /= count
      return seek(boid, { x: centerX, y: centerY })
    }

    return { x: 0, y: 0 }
  }

  const limitForce = (force: { x: number; y: number }, maxForce: number) => {
    const magnitude = Math.sqrt(force.x ** 2 + force.y ** 2)
    if (magnitude > maxForce) {
      return {
        x: (force.x / magnitude) * maxForce,
        y: (force.y / magnitude) * maxForce
      }
    }
    return force
  }

  const seek = (boid: Boid, target: { x: number; y: number }) => {
    const desired = {
      x: target.x - boid.x,
      y: target.y - boid.y
    }
    const magnitude = Math.sqrt(desired.x ** 2 + desired.y ** 2)
    if (magnitude > 0) {
      desired.x = (desired.x / magnitude) * boid.maxSpeed
      desired.y = (desired.y / magnitude) * boid.maxSpeed
    }
    const steer = {
      x: desired.x - boid.vx,
      y: desired.y - boid.vy
    }
    return limitForce(steer, boid.maxForce)
  }

  const edgeAvoidance = (boid: Boid) => {
    let steerX = 0
    let steerY = 0

    if (boid.x < EDGE_MARGIN) {
      steerX = (EDGE_MARGIN - boid.x) / EDGE_MARGIN
    } else if (boid.x > CANVAS_WIDTH - EDGE_MARGIN) {
      steerX = -(boid.x - (CANVAS_WIDTH - EDGE_MARGIN)) / EDGE_MARGIN
    }

    if (boid.y < EDGE_MARGIN) {
      steerY = (EDGE_MARGIN - boid.y) / EDGE_MARGIN
    } else if (boid.y > CANVAS_HEIGHT - EDGE_MARGIN) {
      steerY = -(boid.y - (CANVAS_HEIGHT - EDGE_MARGIN)) / EDGE_MARGIN
    }

    return limitForce({ x: steerX * 2, y: steerY * 2 }, boid.maxForce * 2)
  }

  const findNearestLeader = (boid: Boid, leaders: LeaderBird[]) => {
    let nearestLeader = null
    let minDistance = Infinity

    for (const leader of leaders) {
      const d = distanceToLeader(boid, leader)
      if (d < LEADER_FOLLOW_RADIUS && d < minDistance) {
        minDistance = d
        nearestLeader = leader
      }
    }

    return nearestLeader
  }

  const followLeader = (boid: Boid, leader: LeaderBird) => {
    const d = distanceToLeader(boid, leader)

    if (d > 0 && d < LEADER_FOLLOW_RADIUS) {
      const influence = Math.max(0, 1 - (d / LEADER_FOLLOW_RADIUS))
      const seekForce = seek(boid, leader)
      return {
        x: seekForce.x * influence * 0.8,
        y: seekForce.y * influence * 0.8
      }
    }

    return { x: 0, y: 0 }
  }

  const updateLeaders = () => {
    const leaders = leadersRef.current
    
    for (const leader of leaders) {
      if (leader.autonomous) {
        const time = Date.now() * 0.001
        const offsetX = Math.sin(time * 0.3 + leader.id * 2) * 200
        const offsetY = Math.cos(time * 0.2 + leader.id * 1.5) * 150
        leader.targetX = CANVAS_WIDTH / 2 + offsetX
        leader.targetY = CANVAS_HEIGHT / 2 + offsetY
      }
      
      const dx = leader.targetX - leader.x
      const dy = leader.targetY - leader.y
      const distance = Math.sqrt(dx ** 2 + dy ** 2)
      
      if (distance > 5) {
        const acceleration = 0.15
        leader.vx += (dx / distance) * acceleration
        leader.vy += (dy / distance) * acceleration
        
        const speed = Math.sqrt(leader.vx ** 2 + leader.vy ** 2)
        if (speed > LEADER_MAX_SPEED) {
          leader.vx = (leader.vx / speed) * LEADER_MAX_SPEED
          leader.vy = (leader.vy / speed) * LEADER_MAX_SPEED
        }
        
        leader.x += leader.vx
        leader.y += leader.vy
      } else {
        leader.vx *= 0.9
        leader.vy *= 0.9
        leader.x += leader.vx
        leader.y += leader.vy
      }

      if (leader.x < 0) leader.x = 0
      if (leader.x > CANVAS_WIDTH) leader.x = CANVAS_WIDTH
      if (leader.y < 0) leader.y = 0
      if (leader.y > CANVAS_HEIGHT) leader.y = CANVAS_HEIGHT
    }
  }

  const updateBoids = () => {
    const boids = boidsRef.current
    const leaders = leadersRef.current

    updateLeaders()

    for (const boid of boids) {
      const nearestLeader = findNearestLeader(boid, leaders)
      boid.followingLeader = nearestLeader ? nearestLeader.id : null

      const sep = separation(boid, boids)
      const ali = alignment(boid, boids)
      const coh = cohesion(boid, boids)
      const leaderForce = nearestLeader ? followLeader(boid, nearestLeader) : { x: 0, y: 0 }
      const edgeForce = edgeAvoidance(boid)

      const totalForceX = sep.x * separationWeight + 
                         ali.x * alignmentWeight + 
                         coh.x * cohesionWeight + 
                         leaderForce.x * leaderInfluence +
                         edgeForce.x * 3.0

      const totalForceY = sep.y * separationWeight + 
                         ali.y * alignmentWeight + 
                         coh.y * cohesionWeight + 
                         leaderForce.y * leaderInfluence +
                         edgeForce.y * 3.0

      boid.vx += totalForceX
      boid.vy += totalForceY

      const speed = Math.sqrt(boid.vx ** 2 + boid.vy ** 2)
      if (speed > boid.maxSpeed) {
        boid.vx = (boid.vx / speed) * boid.maxSpeed
        boid.vy = (boid.vy / speed) * boid.maxSpeed
      } else if (speed < MIN_SPEED) {
        boid.vx = (boid.vx / speed) * MIN_SPEED
        boid.vy = (boid.vy / speed) * MIN_SPEED
      }

      boid.x += boid.vx
      boid.y += boid.vy

      boid.angle = Math.atan2(boid.vy, boid.vx)

      if (boid.x < -10) boid.x = CANVAS_WIDTH + 10
      if (boid.x > CANVAS_WIDTH + 10) boid.x = -10
      if (boid.y < -10) boid.y = CANVAS_HEIGHT + 10
      if (boid.y > CANVAS_HEIGHT + 10) boid.y = -10
    }
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, '#0f172a')
    gradient.addColorStop(1, '#1e293b')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const boids = boidsRef.current
    const leaders = leadersRef.current

    for (const boid of boids) {
      ctx.save()
      ctx.translate(boid.x, boid.y)
      ctx.rotate(boid.angle)
      
      let boidColor = 'rgba(59, 130, 246, 0.8)'
      if (boid.followingLeader !== null) {
        const leader = leaders.find(l => l.id === boid.followingLeader)
        if (leader) {
          const r = parseInt(leader.color.slice(1, 3), 16)
          const g = parseInt(leader.color.slice(3, 5), 16)
          const b = parseInt(leader.color.slice(5, 7), 16)
          boidColor = `rgba(${r}, ${g}, ${b}, 0.6)`
        }
      }
      
      ctx.fillStyle = boidColor
      
      ctx.beginPath()
      ctx.moveTo(10, 0)
      ctx.lineTo(-5, -3)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-5, 3)
      ctx.closePath()
      ctx.fill()
      
      ctx.fillStyle = boidColor.replace('0.6', '0.4').replace('0.8', '0.5')
      ctx.beginPath()
      ctx.moveTo(6, 0)
      ctx.lineTo(-2, -1.5)
      ctx.lineTo(-2, 1.5)
      ctx.closePath()
      ctx.fill()
      
      ctx.restore()
    }

    for (const leader of leaders) {
      ctx.save()
      ctx.translate(leader.x, leader.y)
      ctx.rotate(Math.atan2(leader.vy, leader.vx))
      
      ctx.fillStyle = leader.color
      ctx.beginPath()
      ctx.moveTo(15, 0)
      ctx.lineTo(-7, -5)
      ctx.lineTo(-4, 0)
      ctx.lineTo(-7, 5)
      ctx.closePath()
      ctx.fill()
      
      const lighterColor = leader.color + '80'
      ctx.fillStyle = lighterColor
      ctx.beginPath()
      ctx.moveTo(10, 0)
      ctx.lineTo(-3, -2.5)
      ctx.lineTo(-3, 2.5)
      ctx.closePath()
      ctx.fill()
      
      ctx.restore()

      ctx.strokeStyle = leader.color + '30'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(leader.x, leader.y, LEADER_FOLLOW_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 1
    ctx.strokeRect(EDGE_MARGIN, EDGE_MARGIN, CANVAS_WIDTH - 2 * EDGE_MARGIN, CANVAS_HEIGHT - 2 * EDGE_MARGIN)
  }

  const animate = () => {
    if (isRunning) {
      updateBoids()
      draw()
    }
    animationRef.current = requestAnimationFrame(animate)
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const leaders = leadersRef.current
    const mouseLeader = leaders.find(l => l.id === mouseControlledLeader)
    if (mouseLeader) {
      mouseLeader.targetX = event.clientX - rect.left
      mouseLeader.targetY = event.clientY - rect.top
    }
  }

  const handleBoidCountChange = (newCount: number) => {
    setBoidCount(newCount)
    initializeBoids(newCount)
  }

  useEffect(() => {
    initializeBoids(boidCount)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning])

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-6 text-center">
          Multi-Leader Bird Flocking Simulation
        </h1>
        
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 rounded font-medium ${
              isRunning 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRunning ? 'Pause' : 'Play'}
          </button>
          
          <button
            onClick={() => initializeBoids(boidCount)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
          >
            Reset
          </button>
          
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Boids:</label>
            <input
              type="range"
              min="50"
              max="300"
              value={boidCount}
              onChange={(e) => handleBoidCountChange(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-white w-8">{boidCount}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Leader Influence:</label>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.1"
              value={leaderInfluence}
              onChange={(e) => setLeaderInfluence(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-white w-8">{leaderInfluence.toFixed(1)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Leaders:</label>
            <input
              type="range"
              min="1"
              max="5"
              value={numLeaders}
              onChange={(e) => {
                const newCount = Number(e.target.value)
                setNumLeaders(newCount)
                const leaders = leadersRef.current
                if (newCount > leaders.length) {
                  for (let i = leaders.length; i < newCount; i++) {
                    leaders.push({
                      id: i,
                      x: Math.random() * CANVAS_WIDTH,
                      y: Math.random() * CANVAS_HEIGHT,
                      vx: 0,
                      vy: 0,
                      targetX: Math.random() * CANVAS_WIDTH,
                      targetY: Math.random() * CANVAS_HEIGHT,
                      color: ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'][i % 5],
                      autonomous: i > 0
                    })
                  }
                } else {
                  leaders.splice(newCount)
                }
              }}
              className="w-20"
            />
            <span className="text-white w-8">{numLeaders}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Mouse Control:</label>
            <select
              value={mouseControlledLeader}
              onChange={(e) => setMouseControlledLeader(Number(e.target.value))}
              className="bg-slate-700 text-white px-2 py-1 rounded"
            >
              {leadersRef.current.slice(0, numLeaders).map((leader) => (
                <option key={leader.id} value={leader.id}>
                  Leader {leader.id + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
          <h3 className="text-white font-semibold mb-3 text-center">Flocking Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="text-slate-300 font-medium text-sm">Separation (Avoid Crowding)</h4>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Weight:</label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={separationWeight}
                  onChange={(e) => setSeparationWeight(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{separationWeight.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Radius:</label>
                <input
                  type="range"
                  min="15"
                  max="50"
                  value={separationRadius}
                  onChange={(e) => setSeparationRadius(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{separationRadius}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-slate-300 font-medium text-sm">Alignment (Match Direction)</h4>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Weight:</label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={alignmentWeight}
                  onChange={(e) => setAlignmentWeight(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{alignmentWeight.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Radius:</label>
                <input
                  type="range"
                  min="30"
                  max="80"
                  value={alignmentRadius}
                  onChange={(e) => setAlignmentRadius(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{alignmentRadius}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-slate-300 font-medium text-sm">Cohesion (Stay Together)</h4>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Weight:</label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={cohesionWeight}
                  onChange={(e) => setCohesionWeight(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{cohesionWeight.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white text-xs">Radius:</label>
                <input
                  type="range"
                  min="30"
                  max="80"
                  value={cohesionRadius}
                  onChange={(e) => setCohesionRadius(Number(e.target.value))}
                  className="w-16"
                />
                <span className="text-white text-xs w-8">{cohesionRadius}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={handleMouseMove}
            className="border border-slate-600 rounded-lg bg-slate-800 cursor-crosshair"
          />
        </div>
        
        <div className="mt-6 text-center text-slate-300">
          <p className="mb-2">
            Move your mouse to control the selected leader bird! Boids will form sub-flocks around different leaders.
          </p>
          <p className="text-sm">
            Multiple leaders create realistic bird flocking with natural merging and splitting of sub-flocks.
            Boids are colored based on which leader they're following.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
