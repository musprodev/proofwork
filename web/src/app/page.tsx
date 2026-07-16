'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { defineChain } from 'viem';
import { Button } from '@/components/ui/button';
import { Download, GitCommit, Play, Rocket, AlertCircle, Menu, X } from 'lucide-react';
import agentsData from '@/data/agents.json';

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
});

const CONTRACT_ADDRESS = '0x41bdE1a2bbdF8859E82E163bb4b38E57f22C2ae0';
const DEPLOYMENT_BLOCK = 45330064n;
const CHUNK_SIZE = 100n;

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://testnet-rpc.monad.xyz'),
});

const agentRegisteredEvent = parseAbiItem('event AgentRegistered(bytes32 indexed agentId, address indexed controller)');
const attestedEvent = parseAbiItem('event Attested(bytes32 indexed agentId, bytes32 indexed actionHash, string actionType, uint256 sequenceNumber, uint256 timestamp)');
const getControllerAbi = parseAbiItem('function getController(bytes32 agentId) external view returns (address)');

type Agent = string;

interface Attestation {
  transactionHash: string;
  blockNumber: number;
  agentId: string;
  actionHash: string;
  actionType: string;
  sequenceNumber: number;
  timestamp?: number;
}

async function fetchLogsInChunks(args: any) {
  const latestBlock = await publicClient.getBlockNumber();
  let currentFrom = DEPLOYMENT_BLOCK;
  const allLogs = [];
  
  const ranges = [];
  while (currentFrom <= latestBlock) {
    let toBlock = currentFrom + CHUNK_SIZE - 1n;
    if (toBlock > latestBlock) toBlock = latestBlock;
    ranges.push({ fromBlock: currentFrom, toBlock });
    currentFrom = toBlock + 1n;
  }
  
  const BATCH_SIZE = 10;
  for (let i = 0; i < ranges.length; i += BATCH_SIZE) {
    const batch = ranges.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(range => publicClient.getLogs({
        ...args,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock
      }))
    );
    allLogs.push(...results.flat());
    await new Promise(r => setTimeout(r, 50));
  }
  return allLogs;
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [controller, setController] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function fetchAgents() {
      try {
        const logs = await fetchLogsInChunks({
          address: CONTRACT_ADDRESS,
          event: agentRegisteredEvent,
        });
        
        const uniqueAgents = Array.from(new Set(logs.map(log => (log as any).args.agentId).filter(Boolean) as string[]));
        setAgents(uniqueAgents);
        
        if (uniqueAgents.length > 0 && !selectedAgent) {
          setSelectedAgent(uniqueAgents[0]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load agents');
      }
    }
    
    fetchAgents();
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        const [logs, ctrl] = await Promise.all([
          fetchLogsInChunks({
            address: CONTRACT_ADDRESS,
            event: attestedEvent,
            args: { agentId: selectedAgent as `0x${string}` }
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: [getControllerAbi],
            functionName: 'getController',
            args: [selectedAgent as `0x${string}`],
          })
        ]);
        
        setController(ctrl as string);
        
        const attestationsData: Attestation[] = logs.map((log: any) => {
          return {
            transactionHash: log.transactionHash,
            blockNumber: Number(log.blockNumber),
            agentId: log.args.agentId,
            actionHash: log.args.actionHash,
            actionType: log.args.actionType,
            sequenceNumber: Number(log.args.sequenceNumber),
            timestamp: Number(log.args.timestamp) * 1000,
          };
        });
        
        setAttestations(attestationsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      } catch (err) {
        console.error(err);
        setError('Failed to load attestations');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedAgent]);

  const handleExport = () => {
    const dataStr = JSON.stringify(attestations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proofwork-receipt-${selectedAgent?.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'commit': return <GitCommit className="h-4 w-4 text-zinc-500" />;
      case 'test': return <Play className="h-4 w-4 text-zinc-500" />;
      case 'deploy': return <Rocket className="h-4 w-4 text-zinc-500" />;
      default: return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const truncate = (str: string) => `${str.slice(0, 10)}...${str.slice(-8)}`;

  if (!isMounted) {
    return <div className="flex h-screen bg-[#0a0a0a]" />;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-zinc-300 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-200"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Left Rail */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0 transition-transform duration-300 ease-in-out
        w-80 border-r border-zinc-800 flex flex-col bg-[#0a0a0a] shadow-2xl md:shadow-none
      `}>
        <div className="p-6 border-b border-zinc-800 pl-20 md:pl-6">
          <h1 className="text-sm font-semibold tracking-wide text-zinc-200">ProofWork</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">TESTNET_10143</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 px-2">Agents</h2>
          {agents.length === 0 && !error && <div className="px-2 text-sm text-zinc-600 font-mono">No agents found.</div>}
          {agents.map((agent) => {
            const label = (agentsData as Record<string, string>)[agent] || truncate(agent);
            return (
              <button
                key={agent}
                onClick={() => {
                  setSelectedAgent(agent);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-mono truncate transition-none rounded-sm ${
                  selectedAgent === agent 
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' 
                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 border border-transparent'
                }`}
                title={agent}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#050505]">
        {/* Header */}
        <header className="flex justify-between items-center p-6 border-b border-zinc-800 bg-[#050505]">
          <div className="md:ml-0 ml-16 truncate">
            <h2 className="text-sm font-medium text-zinc-200">Attestation Timeline</h2>
            <div className="text-xs text-zinc-500 font-mono mt-1 truncate max-w-sm md:max-w-xl">
              {selectedAgent ? (
                <>
                  <span className="text-zinc-400">Agent:</span> {(agentsData as Record<string, string>)[selectedAgent] || selectedAgent} 
                  {controller && (
                    <span className="ml-4">
                      <span className="text-zinc-600">Controller:</span> {controller}
                    </span>
                  )}
                </>
              ) : 'Select an agent to view logs'}
            </div>
          </div>
          <Button 
            onClick={handleExport} 
            disabled={!selectedAgent || attestations.length === 0}
            variant="outline"
            size="sm"
            className="border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-sm"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Export Receipt
          </Button>
        </header>

        {/* Timeline */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12">
          <div className="max-w-3xl mx-auto">
            {error ? (
              <div className="p-4 border border-red-900/30 bg-red-950/10 text-red-500 text-sm font-mono rounded-sm">
                ERR: {error}
              </div>
            ) : loading && selectedAgent ? (
              <div className="flex justify-center items-center h-32 text-zinc-600 font-mono text-xs">
                FETCHING_BLOCKS...
              </div>
            ) : attestations.length > 0 ? (
              <div className="relative border-l border-zinc-800 ml-3 space-y-6 py-2">
                {attestations.map((att) => (
                  <div key={att.transactionHash} className="relative pl-8">
                    {/* Timeline Node */}
                    <div className="absolute -left-[13px] top-1.5 bg-[#050505] p-1">
                      <div className="border border-zinc-700 bg-zinc-900 rounded-sm p-1">
                        {getIcon(att.actionType)}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-4 hover:border-zinc-600 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
                        <span className="inline-flex items-center rounded-sm bg-zinc-900 px-2 py-1 text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider border border-zinc-800">
                          {att.actionType}
                        </span>
                        {att.timestamp && (
                          <span className="text-xs font-mono text-zinc-500">
                            {new Date(att.timestamp).toISOString()}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-x-2 gap-y-3 text-xs md:text-sm">
                        <span className="text-zinc-600 uppercase tracking-widest text-[10px] font-bold mt-0.5">Seq No</span>
                        <span className="font-mono text-zinc-200">#{att.sequenceNumber}</span>

                        <span className="text-zinc-600 uppercase tracking-widest text-[10px] font-bold mt-0.5">Data Hash</span>
                        <span className="font-mono text-zinc-200 break-all bg-zinc-900/50 p-1.5 rounded-sm border border-zinc-800/50">{att.actionHash}</span>
                        
                        <span className="text-zinc-600 uppercase tracking-widest text-[10px] font-bold mt-0.5">Tx Hash</span>
                        <a 
                          href={`https://testnet.monadexplorer.com/tx/${att.transactionHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-zinc-400 hover:text-zinc-100 underline decoration-zinc-800 hover:decoration-zinc-500 underline-offset-4 transition-colors break-all"
                        >
                          {att.transactionHash}
                        </a>
                        
                        <span className="text-zinc-600 uppercase tracking-widest text-[10px] font-bold mt-0.5">Block</span>
                        <span className="font-mono text-zinc-500">{att.blockNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-600 font-mono text-sm border border-dashed border-zinc-800 rounded-sm bg-zinc-950/30">
                {selectedAgent ? '0 LOGS_FOUND' : 'AWAITING_AGENT_SELECTION'}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
