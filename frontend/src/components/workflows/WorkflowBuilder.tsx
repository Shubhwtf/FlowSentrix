import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    Bug,
    Database,
    FileSearch,
    GitBranch,
    GripHorizontal,
    Mail,
    Plus,
    Search,
    Shield,
    Siren,
    Wrench,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import { API } from '../../api/client';

type TriggerType = 'Manual' | 'Webhook' | 'Schedule' | 'Email Arrival' | 'GitHub Event' | 'CVE Detected';

interface MappingPair {
    key: string;
    value: string;
}

interface WorkflowNode {
    id: string;
    agentType: string;
    category: 'trigger' | 'data' | 'action' | 'analysis' | 'output' | 'system';
    position: { x: number; y: number };
    confidenceThreshold: number;
    integrations: string[];
    inputMappings: MappingPair[];
    outputMappings: MappingPair[];
    triggerType?: TriggerType;
    triggerConfig?: Record<string, string>;
}

interface Edge {
    sourceNodeId: string;
    targetNodeId: string;
}

interface BuilderState {
    nodes: WorkflowNode[];
    edges: Edge[];
    selectedNodeId: string | null;
    zoom: number;
    panOffset: { x: number; y: number };
    workflowName: string;
    isDirty: boolean;
}

type BuilderAction =
    | { type: 'ADD_NODE'; payload: WorkflowNode }
    | { type: 'MOVE_NODE'; payload: { nodeId: string; position: { x: number; y: number } } }
    | { type: 'DELETE_NODE'; payload: { nodeId: string } }
    | { type: 'SELECT_NODE'; payload: { nodeId: string | null } }
    | { type: 'UPDATE_NODE_CONFIG'; payload: { nodeId: string; updates: Partial<WorkflowNode> } }
    | { type: 'ADD_EDGE'; payload: Edge }
    | { type: 'DELETE_EDGE'; payload: Edge }
    | { type: 'SET_ZOOM'; payload: { zoom: number } }
    | { type: 'SET_PAN'; payload: { panOffset: { x: number; y: number } } }
    | { type: 'SET_NAME'; payload: { workflowName: string } }
    | { type: 'SET_ALL'; payload: BuilderState };

interface WorkflowBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: { name: string; steps: string; confidence_thresholds: string } | null;
}

interface PaletteNode {
    agentType: string;
    category: WorkflowNode['category'];
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const paletteGroups: Array<{ label: string; nodes: PaletteNode[] }> = [
    {
        label: 'Data / Read',
        nodes: [
            { agentType: 'EmailWorker', category: 'data', icon: Mail },
            { agentType: 'DiffAgent', category: 'data', icon: FileSearch },
            { agentType: 'DataCollectionAgent', category: 'data', icon: Database }
        ]
    },
    {
        label: 'Write / Action',
        nodes: [
            { agentType: 'CRMWorker', category: 'action', icon: Wrench },
            { agentType: 'ITWorker', category: 'action', icon: Wrench },
            { agentType: 'PRAgent', category: 'action', icon: GitBranch }
        ]
    },
    {
        label: 'Analysis',
        nodes: [
            { agentType: 'LogicAgent', category: 'analysis', icon: Search },
            { agentType: 'PolicyAgent', category: 'analysis', icon: Shield },
            { agentType: 'AnomalyAgent', category: 'analysis', icon: AlertTriangle }
        ]
    },
    {
        label: 'Output / Notify',
        nodes: [
            { agentType: 'NotifyWorker', category: 'output', icon: Bell },
            { agentType: 'AlertAgent', category: 'output', icon: Siren },
            { agentType: 'DistributionAgent', category: 'output', icon: Plus }
        ]
    },
    {
        label: 'Healer / Monitor',
        nodes: [
            { agentType: 'HealerAgent', category: 'system', icon: Bug },
            { agentType: 'MonitorAgent', category: 'system', icon: Shield }
        ]
    }
];

const categoryBorder: Record<WorkflowNode['category'], string> = {
    trigger: 'var(--text-primary)',
    data: '#3B82F6',
    action: '#8B5CF6',
    analysis: '#F59E0B',
    output: '#22C55E',
    system: '#EF4444'
};

const makeId = () => crypto.randomUUID();

const initialTriggerNode = (): WorkflowNode => ({
    id: makeId(),
    agentType: 'Trigger',
    category: 'trigger',
    position: { x: 400, y: 80 },
    confidenceThreshold: 90,
    integrations: [],
    inputMappings: [],
    outputMappings: [],
    triggerType: 'Manual',
    triggerConfig: {}
});

const initialState = (): BuilderState => ({
    nodes: [initialTriggerNode()],
    edges: [],
    selectedNodeId: null,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    workflowName: '',
    isDirty: false
});

const builderReducer = (state: BuilderState, action: BuilderAction): BuilderState => {
    switch (action.type) {
        case 'ADD_NODE':
            return { ...state, nodes: [...state.nodes, action.payload], isDirty: true };
        case 'MOVE_NODE':
            return {
                ...state,
                nodes: state.nodes.map((node) => node.id === action.payload.nodeId ? { ...node, position: action.payload.position } : node),
                isDirty: true
            };
        case 'DELETE_NODE':
            if (state.nodes.find((node) => node.id === action.payload.nodeId)?.category === 'trigger') return state;
            return {
                ...state,
                nodes: state.nodes.filter((node) => node.id !== action.payload.nodeId),
                edges: state.edges.filter((edge) => edge.sourceNodeId !== action.payload.nodeId && edge.targetNodeId !== action.payload.nodeId),
                selectedNodeId: state.selectedNodeId === action.payload.nodeId ? null : state.selectedNodeId,
                isDirty: true
            };
        case 'SELECT_NODE':
            return { ...state, selectedNodeId: action.payload.nodeId };
        case 'UPDATE_NODE_CONFIG':
            return {
                ...state,
                nodes: state.nodes.map((node) => node.id === action.payload.nodeId ? { ...node, ...action.payload.updates } : node),
                isDirty: true
            };
        case 'ADD_EDGE': {
            const alreadyExists = state.edges.some((edge) => edge.sourceNodeId === action.payload.sourceNodeId && edge.targetNodeId === action.payload.targetNodeId);
            if (alreadyExists) return state;
            return { ...state, edges: [...state.edges, action.payload], isDirty: true };
        }
        case 'DELETE_EDGE':
            return {
                ...state,
                edges: state.edges.filter((edge) => !(edge.sourceNodeId === action.payload.sourceNodeId && edge.targetNodeId === action.payload.targetNodeId)),
                isDirty: true
            };
        case 'SET_ZOOM':
            return { ...state, zoom: action.payload.zoom };
        case 'SET_PAN':
            return { ...state, panOffset: action.payload.panOffset };
        case 'SET_NAME':
            return { ...state, workflowName: action.payload.workflowName, isDirty: true };
        case 'SET_ALL':
            return action.payload;
        default:
            return state;
    }
};

const getCategory = (agentType: string): WorkflowNode['category'] => {
    const lower = agentType.toLowerCase();
    if (lower.includes('emailworker') || lower.includes('diffagent') || lower.includes('datacollectionagent')) return 'data';
    if (lower.includes('crmworker') || lower.includes('itworker') || lower.includes('pragent')) return 'action';
    if (lower.includes('logicagent') || lower.includes('policyagent') || lower.includes('anomalyagent')) return 'analysis';
    if (lower.includes('notifyworker') || lower.includes('alertagent') || lower.includes('distributionagent')) return 'output';
    if (lower.includes('healer') || lower.includes('monitor')) return 'system';
    return 'analysis';
};

const pickIcon = (agentType: string) => {
    const item = paletteGroups.flatMap((group) => group.nodes).find((node) => node.agentType === agentType);
    return item?.icon || Wrench;
};

const toLogicalConfig = (state: BuilderState) => {
    const triggerNode = state.nodes.find((node) => node.category === 'trigger');
    const incomingCount = new Map<string, number>();
    state.nodes.forEach((node) => incomingCount.set(node.id, 0));
    state.edges.forEach((edge) => incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) || 0) + 1));
    const triggerId = triggerNode?.id || '';
    const queue = [triggerId];
    const orderedNodeIds: string[] = [];
    const visited = new Set<string>();
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        if (current !== triggerId) orderedNodeIds.push(current);
        const outgoing = state.edges.filter((edge) => edge.sourceNodeId === current).map((edge) => edge.targetNodeId);
        outgoing.forEach((targetId) => {
            const currentCount = (incomingCount.get(targetId) || 1) - 1;
            incomingCount.set(targetId, currentCount);
            if (currentCount <= 0) queue.push(targetId);
        });
    }
    const fallbackOrdered = state.nodes.filter((node) => node.category !== 'trigger').sort((a, b) => a.position.y - b.position.y).map((node) => node.id);
    const finalOrder = orderedNodeIds.length > 0 ? orderedNodeIds : fallbackOrdered;
    const orderedNodes = finalOrder.map((id) => state.nodes.find((node) => node.id === id)).filter((node): node is WorkflowNode => Boolean(node));
    const steps = orderedNodes.map((node, index) => ({
        index: index + 1,
        agentType: node.agentType,
        systemPrompt: '',
        allowedTools: [],
        confidenceThreshold: node.confidenceThreshold,
        integrations: node.integrations,
        inputMappings: node.inputMappings,
        outputMappings: node.outputMappings
    }));
    const thresholds: Record<string, number> = { global: 90 };
    orderedNodes.forEach((node, index) => {
        thresholds[String(index)] = node.confidenceThreshold;
    });
    return {
        name: state.workflowName || 'Untitled Workflow',
        trigger: {
            type: triggerNode?.triggerType || 'Manual',
            config: triggerNode?.triggerConfig || {}
        },
        steps,
        confidence_thresholds: thresholds
    };
};

const isWorkflowValid = (state: BuilderState) => {
    const trigger = state.nodes.find((node) => node.category === 'trigger');
    if (!trigger) return false;
    const nonTrigger = state.nodes.filter((node) => node.category !== 'trigger');
    if (nonTrigger.length === 0) return false;
    const triggerOutgoing = state.edges.filter((edge) => edge.sourceNodeId === trigger.id).length;
    if (triggerOutgoing === 0) return false;
    for (const node of nonTrigger) {
        const incoming = state.edges.filter((edge) => edge.targetNodeId === node.id).length;
        const outgoing = state.edges.filter((edge) => edge.sourceNodeId === node.id).length;
        if (incoming === 0) return false;
        if (node !== nonTrigger[nonTrigger.length - 1] && outgoing === 0) return false;
    }
    return true;
};

const parseTemplateState = (initialData?: { name: string; steps: string; confidence_thresholds: string } | null): BuilderState => {
    if (!initialData) return initialState();
    const trigger = initialTriggerNode();
    let parsedSteps: unknown = [];
    try {
        parsedSteps = JSON.parse(initialData.steps);
    } catch {
        parsedSteps = [];
    }
    let parsedThresholds: Record<string, number> = { global: 90 };
    try {
        const raw = JSON.parse(initialData.confidence_thresholds);
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
            const out: Record<string, number> = {};
            Object.entries(raw).forEach(([key, value]) => {
                if (typeof value === 'number') out[key] = value;
            });
            parsedThresholds = Object.keys(out).length > 0 ? out : parsedThresholds;
        }
    } catch {
    }
    const nodes: WorkflowNode[] = [trigger];
    const edges: Edge[] = [];
    if (Array.isArray(parsedSteps)) {
        parsedSteps.forEach((rawStep, index) => {
            if (typeof rawStep !== 'object' || rawStep === null || Array.isArray(rawStep)) return;
            const agentType = typeof rawStep.agentType === 'string' ? rawStep.agentType : `Step${index + 1}`;
            const nodeId = makeId();
            const confidenceThreshold = typeof parsedThresholds[String(index)] === 'number'
                ? parsedThresholds[String(index)]
                : typeof parsedThresholds.global === 'number'
                    ? parsedThresholds.global
                    : 90;
            nodes.push({
                id: nodeId,
                agentType,
                category: getCategory(agentType),
                position: { x: 400, y: 80 + (index + 1) * 160 },
                confidenceThreshold,
                integrations: [],
                inputMappings: [],
                outputMappings: []
            });
        });
    }
    for (let index = 0; index < nodes.length - 1; index += 1) {
        edges.push({ sourceNodeId: nodes[index].id, targetNodeId: nodes[index + 1].id });
    }
    return {
        nodes,
        edges,
        selectedNodeId: null,
        zoom: 1,
        panOffset: { x: 0, y: 0 },
        workflowName: `Copy of ${initialData.name}`,
        isDirty: false
    };
};

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [state, dispatch] = useReducer(builderReducer, undefined, initialState);
    const [registeredIntegrations, setRegisteredIntegrations] = useState<Array<{ id: string; name: string }>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [connectionDraft, setConnectionDraft] = useState<{ sourceNodeId: string; x: number; y: number } | null>(null);
    const [draggingNode, setDraggingNode] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
    const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(state.zoom);
    const panRef = useRef(state.panOffset);

    const selectedNode = useMemo(
        () => state.nodes.find((node) => node.id === state.selectedNodeId) || null,
        [state.nodes, state.selectedNodeId]
    );
    const logicalConfig = useMemo(() => toLogicalConfig(state), [state]);
    const validWorkflow = useMemo(() => isWorkflowValid(state), [state]);

    useEffect(() => {
        zoomRef.current = state.zoom;
    }, [state.zoom]);

    useEffect(() => {
        panRef.current = state.panOffset;
    }, [state.panOffset]);

    useEffect(() => {
        if (!isOpen) return;
        dispatch({ type: 'SET_ALL', payload: parseTemplateState(initialData) });
        API.integrations.list()
            .then((list) => {
                const normalized = list.map((item) => {
                    const id = typeof item?.id === 'string' ? item.id : makeId();
                    const name = typeof item?.name === 'string' && item.name.length > 0 ? item.name : id;
                    return { id, name };
                });
                setRegisteredIntegrations(normalized);
            })
            .catch(() => setRegisteredIntegrations([]));
        setErrorText('');
        setSelectedEdge(null);
        setJsonOpen(false);
    }, [isOpen, initialData]);

    useEffect(() => {
        if (!isOpen) return;
        const onMouseMove = (event: MouseEvent) => {
            if (draggingNode && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const nextX = (event.clientX - rect.left - state.panOffset.x) / state.zoom - draggingNode.offsetX;
                const nextY = (event.clientY - rect.top - state.panOffset.y) / state.zoom - draggingNode.offsetY;
                dispatch({ type: 'MOVE_NODE', payload: { nodeId: draggingNode.nodeId, position: { x: nextX, y: nextY } } });
            }
            if (connectionDraft && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setConnectionDraft({
                    sourceNodeId: connectionDraft.sourceNodeId,
                    x: (event.clientX - rect.left - state.panOffset.x) / state.zoom,
                    y: (event.clientY - rect.top - state.panOffset.y) / state.zoom
                });
            }
            if (panning) {
                const deltaX = event.clientX - panning.startX;
                const deltaY = event.clientY - panning.startY;
                dispatch({
                    type: 'SET_PAN',
                    payload: { panOffset: { x: panning.panX + deltaX, y: panning.panY + deltaY } }
                });
            }
        };
        const onMouseUp = () => {
            setDraggingNode(null);
            setConnectionDraft(null);
            setPanning(null);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isOpen, draggingNode, connectionDraft, state.panOffset.x, state.panOffset.y, state.zoom, panning]);

    if (!isOpen) return null;

    const addNodeAt = (agentType: string, category: WorkflowNode['category'], x: number, y: number) => {
        dispatch({
            type: 'ADD_NODE',
            payload: {
                id: makeId(),
                agentType,
                category,
                position: { x, y },
                confidenceThreshold: 90,
                integrations: [],
                inputMappings: [],
                outputMappings: []
            }
        });
    };

    const handleCanvasDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
        event.preventDefault();
        if (!canvasRef.current) return;
        const agentType = event.dataTransfer.getData('agentType');
        const category = event.dataTransfer.getData('category');
        if (!agentType) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left - state.panOffset.x) / state.zoom;
        const y = (event.clientY - rect.top - state.panOffset.y) / state.zoom;
        const mappedCategory: WorkflowNode['category'] = category === 'data' || category === 'action' || category === 'analysis' || category === 'output' || category === 'system' ? category : 'analysis';
        addNodeAt(agentType, mappedCategory, x, y);
    };

    const handleCanvasWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        const nextZoom = Math.min(1.5, Math.max(0.5, Number((state.zoom + delta).toFixed(2))));
        dispatch({ type: 'SET_ZOOM', payload: { zoom: nextZoom } });
    };

    const fitToScreen = () => {
        dispatch({ type: 'SET_ZOOM', payload: { zoom: 1 } });
        dispatch({ type: 'SET_PAN', payload: { panOffset: { x: 0, y: 0 } } });
    };

    const startNodeDrag = (event: React.MouseEvent, node: WorkflowNode) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left) / state.zoom;
        const offsetY = (event.clientY - rect.top) / state.zoom;
        setDraggingNode({ nodeId: node.id, offsetX, offsetY });
        dispatch({ type: 'SELECT_NODE', payload: { nodeId: node.id } });
    };

    const startPan: React.MouseEventHandler<HTMLDivElement> = (event) => {
        if (event.target !== event.currentTarget) return;
        setPanning({ startX: event.clientX, startY: event.clientY, panX: state.panOffset.x, panY: state.panOffset.y });
        dispatch({ type: 'SELECT_NODE', payload: { nodeId: null } });
        setSelectedEdge(null);
    };

    const nodeCenter = (nodeId: string, port: 'in' | 'out') => {
        const node = state.nodes.find((item) => item.id === nodeId);
        if (!node) return { x: 0, y: 0 };
        const width = node.category === 'trigger' ? 240 : 200;
        const height = 130;
        const x = node.position.x + width / 2;
        const y = port === 'in' ? node.position.y : node.position.y + height;
        return { x, y };
    };

    const drawPath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
        const c1 = source.y + 56;
        const c2 = target.y - 56;
        return `M ${source.x} ${source.y} C ${source.x} ${c1}, ${target.x} ${c2}, ${target.x} ${target.y}`;
    };

    const handleValidate = async () => {
        setIsValidating(true);
        setErrorText('');
        try {
            const payload = { ...logicalConfig, dryRun: true };
            const response = await fetch(`${BASE_URL}/workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Validation failed (${response.status})`);
            setErrorText('Validation passed');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Validation failed';
            setErrorText(message);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setErrorText('');
        try {
            await API.workflows.create(logicalConfig);
            onSuccess();
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Save failed';
            setErrorText(message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleIntegration = (node: WorkflowNode, integrationId: string) => {
        const hasIntegration = node.integrations.includes(integrationId);
        const next = hasIntegration
            ? node.integrations.filter((entry) => entry !== integrationId)
            : [...node.integrations, integrationId];
        dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: node.id, updates: { integrations: next } } });
    };

    const updateMappingPair = (node: WorkflowNode, type: 'inputMappings' | 'outputMappings', index: number, patch: Partial<MappingPair>) => {
        const next = node[type].map((entry, mappingIndex) => mappingIndex === index ? { ...entry, ...patch } : entry);
        dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: node.id, updates: { [type]: next } } });
    };

    const addMappingPair = (node: WorkflowNode, type: 'inputMappings' | 'outputMappings') => {
        const next = [...node[type], { key: '', value: '' }];
        dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: node.id, updates: { [type]: next } } });
    };

    const removeMappingPair = (node: WorkflowNode, type: 'inputMappings' | 'outputMappings', index: number) => {
        const next = node[type].filter((_, mappingIndex) => mappingIndex !== index);
        dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: node.id, updates: { [type]: next } } });
    };

    const highlightedJson = JSON.stringify(logicalConfig, null, 2)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"([^"]+)":/g, '<span class="text-text-muted">"$1"</span>:')
        .replace(/: "([^"]*)"/g, ': <span class="text-text-primary">"$1"</span>')
        .replace(/: (\d+(\.\d+)?)/g, ': <span style="color:#3B82F6">$1</span>')
        .replace(/: (true|false)/g, ': <span style="color:#F59E0B">$1</span>');

    return (
        <div className="fixed inset-0 z-[80] bg-background">
            <div className="absolute inset-0 flex">
                <aside className="w-[240px] border-r border-border bg-surface p-4 overflow-y-auto">
                    <p className="font-mono text-[11px] uppercase tracking-wide text-text-muted mb-4">ADD NODE</p>
                    <div className="space-y-4">
                        {paletteGroups.map((group) => (
                            <div key={group.label}>
                                <p className="font-mono text-[10px] uppercase text-text-muted mb-2">{group.label}</p>
                                <div className="flex flex-wrap gap-2">
                                    {group.nodes.map((node) => (
                                        <button
                                            key={node.agentType}
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData('agentType', node.agentType);
                                                event.dataTransfer.setData('category', node.category);
                                            }}
                                            className="inline-flex items-center gap-2 bg-surface-elevated border border-border rounded-sm px-2.5 py-1.5 text-xs"
                                        >
                                            <node.icon size={12} strokeWidth={1.5} />
                                            <span>{node.agentType}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="relative flex-1 overflow-hidden">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-surface border border-border rounded-md h-10 px-2 flex items-center gap-2 shadow-subtle">
                        <input
                            value={state.workflowName}
                            onChange={(event) => dispatch({ type: 'SET_NAME', payload: { workflowName: event.target.value } })}
                            placeholder="Untitled Workflow"
                            className="h-7 w-56 px-2 bg-background border border-border text-sm outline-none"
                        />
                        <div className="w-px h-5 bg-border" />
                        <button onClick={() => dispatch({ type: 'SET_ZOOM', payload: { zoom: Math.max(0.5, Number((state.zoom - 0.1).toFixed(2))) } })} className="h-7 w-7 border border-border inline-flex items-center justify-center">
                            <ZoomOut size={14} />
                        </button>
                        <span className="font-mono text-xs w-14 text-center">{Math.round(state.zoom * 100)}%</span>
                        <button onClick={() => dispatch({ type: 'SET_ZOOM', payload: { zoom: Math.min(1.5, Number((state.zoom + 0.1).toFixed(2))) } })} className="h-7 w-7 border border-border inline-flex items-center justify-center">
                            <ZoomIn size={14} />
                        </button>
                        <div className="w-px h-5 bg-border" />
                        <button onClick={fitToScreen} className="h-7 px-3 border border-border text-xs">Fit to Screen</button>
                        <div className="w-px h-5 bg-border" />
                        <button onClick={() => setJsonOpen((value) => !value)} className="h-7 px-3 border border-border text-xs">JSON</button>
                        <div className="w-px h-5 bg-border" />
                        <button onClick={handleValidate} disabled={isValidating} className="h-7 px-3 border border-border text-xs disabled:opacity-50">{isValidating ? 'Validating' : 'Validate'}</button>
                        <button onClick={handleSave} disabled={isSaving} className="h-7 px-3 bg-accent text-accent-foreground text-xs disabled:opacity-50">{isSaving ? 'Saving' : 'Save & Register'}</button>
                    </div>

                    <button onClick={onClose} className="absolute right-4 top-4 z-20 h-8 w-8 border border-border bg-surface inline-flex items-center justify-center">
                        <X size={14} />
                    </button>

                    <div
                        ref={canvasRef}
                        onMouseDown={startPan}
                        onWheel={handleCanvasWheel}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleCanvasDrop}
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    >
                        <svg className="absolute inset-0 h-full w-full pointer-events-none">
                            <defs>
                                <pattern id="builder-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <circle cx="1" cy="1" r="1" fill="var(--border)" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#builder-grid)" />
                        </svg>

                        <div
                            className="absolute inset-0"
                            style={{
                                transform: `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${state.zoom})`,
                                transformOrigin: '0 0'
                            }}
                        >
                            <svg className="absolute inset-0 overflow-visible pointer-events-none">
                                {state.edges.map((edge) => {
                                    const source = nodeCenter(edge.sourceNodeId, 'out');
                                    const target = nodeCenter(edge.targetNodeId, 'in');
                                    const path = drawPath(source, target);
                                    const selected = selectedEdge?.sourceNodeId === edge.sourceNodeId && selectedEdge?.targetNodeId === edge.targetNodeId;
                                    const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
                                    return (
                                        <g key={`${edge.sourceNodeId}-${edge.targetNodeId}`}>
                                            <path
                                                d={path}
                                                stroke={validWorkflow ? 'var(--text-primary)' : 'var(--border)'}
                                                strokeWidth={2}
                                                fill="none"
                                                style={{ pointerEvents: 'stroke' }}
                                                onClick={() => setSelectedEdge(edge)}
                                            />
                                            {selected && (
                                                <g style={{ pointerEvents: 'all' }}>
                                                    <circle cx={midpoint.x} cy={midpoint.y} r={11} fill="var(--surface)" stroke="var(--border)" />
                                                    <text x={midpoint.x} y={midpoint.y + 4} textAnchor="middle" fill="var(--text-primary)" fontSize="12" className="cursor-pointer" onClick={() => dispatch({ type: 'DELETE_EDGE', payload: edge })}>
                                                        ×
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}
                                {connectionDraft && (
                                    <path
                                        d={drawPath(nodeCenter(connectionDraft.sourceNodeId, 'out'), { x: connectionDraft.x, y: connectionDraft.y })}
                                        stroke="var(--text-primary)"
                                        strokeWidth={2}
                                        fill="none"
                                        strokeDasharray="6 4"
                                    />
                                )}
                            </svg>

                            {state.nodes.map((node) => {
                                const Icon = pickIcon(node.agentType);
                                const selected = node.id === state.selectedNodeId;
                                return (
                                    <div
                                        key={node.id}
                                        className={`absolute min-w-[200px] ${node.category === 'trigger' ? 'min-w-[240px]' : ''} bg-surface border rounded-md`}
                                        style={{
                                            left: node.position.x,
                                            top: node.position.y,
                                            borderColor: selected ? 'var(--text-primary)' : 'var(--border)',
                                            borderLeftWidth: 3,
                                            borderLeftColor: categoryBorder[node.category]
                                        }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            dispatch({ type: 'SELECT_NODE', payload: { nodeId: node.id } });
                                            setSelectedEdge(null);
                                        }}
                                    >
                                        <div className="h-10 px-3 border-b border-border flex items-center justify-between cursor-move" onMouseDown={(event) => startNodeDrag(event, node)}>
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} strokeWidth={1.5} />
                                                <span className="text-xs font-semibold">{node.agentType}</span>
                                            </div>
                                            <GripHorizontal size={14} strokeWidth={1.5} className="text-text-muted" />
                                        </div>
                                        <div className="p-3 space-y-3">
                                            {node.category === 'trigger' ? (
                                                <>
                                                    <select
                                                        value={node.triggerType || 'Manual'}
                                                        onChange={(event) => dispatch({
                                                            type: 'UPDATE_NODE_CONFIG',
                                                            payload: {
                                                                nodeId: node.id,
                                                                updates: {
                                                                    triggerType: event.target.value === 'Manual' || event.target.value === 'Webhook' || event.target.value === 'Schedule' || event.target.value === 'Email Arrival' || event.target.value === 'GitHub Event' || event.target.value === 'CVE Detected'
                                                                        ? event.target.value
                                                                        : 'Manual'
                                                                }
                                                            }
                                                        })}
                                                        className="w-full h-8 px-2 text-xs bg-background border border-border outline-none"
                                                    >
                                                        <option>Manual</option>
                                                        <option>Webhook</option>
                                                        <option>Schedule</option>
                                                        <option>Email Arrival</option>
                                                        <option>GitHub Event</option>
                                                        <option>CVE Detected</option>
                                                    </select>
                                                    <input
                                                        placeholder="Trigger config key"
                                                        value={node.triggerConfig?.key || ''}
                                                        onChange={(event) => dispatch({
                                                            type: 'UPDATE_NODE_CONFIG',
                                                            payload: {
                                                                nodeId: node.id,
                                                                updates: { triggerConfig: { ...(node.triggerConfig || {}), key: event.target.value } }
                                                            }
                                                        })}
                                                        className="w-full h-8 px-2 text-xs bg-background border border-border outline-none"
                                                    />
                                                    <input
                                                        placeholder="Trigger config value"
                                                        value={node.triggerConfig?.value || ''}
                                                        onChange={(event) => dispatch({
                                                            type: 'UPDATE_NODE_CONFIG',
                                                            payload: {
                                                                nodeId: node.id,
                                                                updates: { triggerConfig: { ...(node.triggerConfig || {}), value: event.target.value } }
                                                            }
                                                        })}
                                                        className="w-full h-8 px-2 text-xs bg-background border border-border outline-none"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-text-secondary">Confidence</span>
                                                        <input
                                                            type="number"
                                                            min={50}
                                                            max={95}
                                                            value={node.confidenceThreshold}
                                                            onChange={(event) => dispatch({
                                                                type: 'UPDATE_NODE_CONFIG',
                                                                payload: { nodeId: node.id, updates: { confidenceThreshold: Math.min(95, Math.max(50, Number(event.target.value) || 50)) } }
                                                            })}
                                                            className="w-16 h-7 px-2 bg-background border border-border outline-none font-mono text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {node.integrations.map((integrationId) => (
                                                            <span data-badge key={integrationId} className="bg-text-primary/10 text-text-primary border border-border">
                                                                {registeredIntegrations.find((item) => item.id === integrationId)?.name || integrationId}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {node.category !== 'trigger' && (
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    dispatch({ type: 'DELETE_NODE', payload: { nodeId: node.id } });
                                                }}
                                                className="absolute -right-2 -top-2 h-5 w-5 bg-surface border border-border rounded-sm text-[10px]"
                                            >
                                                ×
                                            </button>
                                        )}
                                        {node.category !== 'trigger' && (
                                            <button
                                                className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-surface bg-border hover:bg-text-primary transition-all hover:h-[14px] hover:w-[14px]"
                                                onMouseUp={(event) => {
                                                    event.stopPropagation();
                                                    if (!connectionDraft) return;
                                                    if (connectionDraft.sourceNodeId === node.id) return;
                                                    dispatch({ type: 'ADD_EDGE', payload: { sourceNodeId: connectionDraft.sourceNodeId, targetNodeId: node.id } });
                                                    setConnectionDraft(null);
                                                }}
                                            />
                                        )}
                                        <button
                                            className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 h-[10px] w-[10px] rounded-full border-2 border-surface bg-border hover:bg-text-primary transition-all hover:h-[14px] hover:w-[14px] cursor-crosshair"
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                const rect = canvasRef.current?.getBoundingClientRect();
                                                if (!rect) return;
                                                setConnectionDraft({
                                                    sourceNodeId: node.id,
                                                    x: (event.clientX - rect.left - state.panOffset.x) / state.zoom,
                                                    y: (event.clientY - rect.top - state.panOffset.y) / state.zoom
                                                });
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="absolute left-3 bottom-3 px-2 py-1 border border-border bg-surface font-mono text-[11px] z-20">
                        {Math.round(state.zoom * 100)}%
                    </div>

                    {errorText && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-16 z-20 px-3 py-1.5 text-xs border border-border bg-surface-elevated">
                            {errorText}
                        </div>
                    )}

                    {jsonOpen && (
                        <div className="absolute left-0 right-0 bottom-0 h-[35%] border-t border-border bg-surface z-20 flex flex-col">
                            <div className="h-10 px-4 border-b border-border flex items-center justify-between">
                                <span className="font-mono text-[11px] uppercase text-text-muted">Workflow JSON</span>
                                <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(logicalConfig, null, 2))}
                                    className="h-7 px-3 text-xs border border-border"
                                >
                                    Copy
                                </button>
                            </div>
                            <pre
                                className="flex-1 overflow-auto p-4 font-mono text-[11px]"
                                dangerouslySetInnerHTML={{ __html: highlightedJson }}
                            />
                        </div>
                    )}
                </div>

                {selectedNode && (
                    <aside className="w-[280px] border-l border-border bg-surface p-4 overflow-y-auto transition-transform duration-180 ease-out">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold">{selectedNode.agentType}</h3>
                            {selectedNode.category !== 'trigger' && (
                                <button onClick={() => dispatch({ type: 'DELETE_NODE', payload: { nodeId: selectedNode.id } })} className="h-7 px-2 border border-border text-xs">Delete</button>
                            )}
                        </div>
                        {selectedNode.category !== 'trigger' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-xs text-text-secondary mb-2">Confidence threshold</label>
                                    <input
                                        type="range"
                                        min={50}
                                        max={95}
                                        value={selectedNode.confidenceThreshold}
                                        onChange={(event) => dispatch({
                                            type: 'UPDATE_NODE_CONFIG',
                                            payload: { nodeId: selectedNode.id, updates: { confidenceThreshold: Number(event.target.value) } }
                                        })}
                                        className="w-full"
                                    />
                                    <p className="font-mono text-xs text-text-muted mt-1">{selectedNode.confidenceThreshold}%</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-xs text-text-secondary mb-2">Integrations</label>
                                    <div className="space-y-1 max-h-36 overflow-auto">
                                        {registeredIntegrations.map((integration) => (
                                            <label key={integration.id} className="flex items-center gap-2 text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNode.integrations.includes(integration.id)}
                                                    onChange={() => toggleIntegration(selectedNode, integration.id)}
                                                />
                                                <span>{integration.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-text-secondary">Input mapping</label>
                                        <button onClick={() => addMappingPair(selectedNode, 'inputMappings')} className="h-6 px-2 text-xs border border-border">Add</button>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedNode.inputMappings.map((pair, index) => (
                                            <div key={`${selectedNode.id}-input-${index}`} className="flex gap-1">
                                                <input value={pair.key} onChange={(event) => updateMappingPair(selectedNode, 'inputMappings', index, { key: event.target.value })} placeholder="from" className="flex-1 h-7 px-2 text-xs bg-background border border-border outline-none" />
                                                <input value={pair.value} onChange={(event) => updateMappingPair(selectedNode, 'inputMappings', index, { value: event.target.value })} placeholder="to" className="flex-1 h-7 px-2 text-xs bg-background border border-border outline-none" />
                                                <button onClick={() => removeMappingPair(selectedNode, 'inputMappings', index)} className="h-7 w-7 border border-border text-xs">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-text-secondary">Output mapping</label>
                                        <button onClick={() => addMappingPair(selectedNode, 'outputMappings')} className="h-6 px-2 text-xs border border-border">Add</button>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedNode.outputMappings.map((pair, index) => (
                                            <div key={`${selectedNode.id}-output-${index}`} className="flex gap-1">
                                                <input value={pair.key} onChange={(event) => updateMappingPair(selectedNode, 'outputMappings', index, { key: event.target.value })} placeholder="from" className="flex-1 h-7 px-2 text-xs bg-background border border-border outline-none" />
                                                <input value={pair.value} onChange={(event) => updateMappingPair(selectedNode, 'outputMappings', index, { value: event.target.value })} placeholder="to" className="flex-1 h-7 px-2 text-xs bg-background border border-border outline-none" />
                                                <button onClick={() => removeMappingPair(selectedNode, 'outputMappings', index)} className="h-7 w-7 border border-border text-xs">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
};
