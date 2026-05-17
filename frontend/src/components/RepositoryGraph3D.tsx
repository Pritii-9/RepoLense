import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods, NodeObject } from 'react-force-graph-3d'
import { Card } from './Card'
import type { CsvHotspot } from '@/types/api'

interface RepositoryGraph3DProps {
  hotspots: CsvHotspot[]
}

interface GraphNode extends NodeObject {
  id: string
  name: string
  val: number
  color: string
  isDir: boolean
}

interface GraphLink {
  source: string
  target: string
}

function buildGraphData(hotspots: CsvHotspot[]) {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  // Add a root node
  nodes.set('root', { id: 'root', name: 'Repository Root', val: 5, color: '#3b82f6', isDir: true })

  hotspots.forEach((hotspot) => {
    const parts = hotspot.filePath.split('/')
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const parentPath = currentPath ? currentPath : 'root'
      currentPath = currentPath ? `${currentPath}/${part}` : part

      const isFile = i === parts.length - 1

      if (!nodes.has(currentPath)) {
        if (isFile) {
          // File node
          const complexity = hotspot.complexity || 1
          let color = '#1fb37f' // Safe
          if (complexity > 15) color = '#e11d48' // Danger/Hotspot
          else if (complexity > 5) color = '#fb8740' // Warning

          nodes.set(currentPath, {
            id: currentPath,
            name: part,
            val: Math.min(Math.max(complexity, 1), 20),
            color,
            isDir: false,
          })
        } else {
          // Directory node
          nodes.set(currentPath, {
            id: currentPath,
            name: part,
            val: 3,
            color: '#94a3b8',
            isDir: true,
          })
        }

        // Link to parent
        links.push({
          source: parentPath,
          target: currentPath,
        })
      }
    }
  })

  return {
    nodes: Array.from(nodes.values()),
    links,
  }
}

export function RepositoryGraph3D({ hotspots }: RepositoryGraph3DProps) {
  const graphRef = useRef<ForceGraphMethods>()
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)

  const graphData = useMemo(() => buildGraphData(hotspots), [hotspots])

  // Handle resizing
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const handleNodeClick = useCallback((node: NodeObject) => {
    if (graphRef.current) {
      // Aim at node from outside it
      const distance = 40
      const distRatio = 1 + distance/Math.hypot(node.x as number, node.y as number, node.z as number)

      graphRef.current.cameraPosition(
        { x: (node.x as number) * distRatio, y: (node.y as number) * distRatio, z: (node.z as number) * distRatio }, // new position
        node as {x: number, y: number, z: number}, // lookAt ({ x, y, z })
        3000  // ms transition duration
      )
    }
  }, [])

  if (!hotspots.length) return null

  return (
    <Card
      title="3D Repository Architecture"
      description="Interactive map of the codebase structure. Red nodes indicate high complexity hotspots."
      className="col-span-full h-[600px] flex flex-col"
    >
      <div ref={containerRef} className="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden mt-4 relative cursor-crosshair">
        <ForceGraph3D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel={(node) => `<div style="background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; font-family: monospace;">${node.name}<br/>${(node as GraphNode).isDir ? 'Directory' : 'File (Complexity: ' + (node as GraphNode).val + ')'}</div>`}
          nodeColor={(node) => (node as GraphNode).color}
          nodeVal={(node) => (node as GraphNode).val}
          linkColor={() => 'rgba(255,255,255,0.1)'}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          backgroundColor="#0f172a"
          showNavInfo={true}
        />
        <div className="absolute bottom-4 left-4 flex gap-3 text-xs bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-lg border border-white/10 pointer-events-none">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1fb37f]" /> Safe</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#fb8740]" /> Warning</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#e11d48]" /> Hotspot</div>
          <div className="flex items-center gap-1.5 ml-2"><div className="w-2 h-2 rounded-full bg-[#94a3b8]" /> Directory</div>
        </div>
      </div>
    </Card>
  )
}
