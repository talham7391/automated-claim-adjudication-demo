<script setup lang="ts">
import type { Workflow } from '@demo/contracts';
import type { FieldDefinition, FieldReference } from '@demo/contracts/workflow_schema_module';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';

definePageMeta({ key: route => route.path });

const route = useRoute();
const activeField = ref<string | null>(null);
const selectedStep = ref<string | null>(null);
const colors = ['#6366f1', '#0891b2', '#d97706', '#db2777', '#059669', '#7c3aed', '#2563eb'];

interface Port {
    id: string;
    fieldId: string;
    name: string;
    description: string;
    source?: string;
}

interface DiagramNode {
    id: string;
    name: string;
    type: string;
    inputs: Port[];
    outputs: Port[];
}

interface Connection {
    id: string;
    fieldId: string;
    name: string;
    from: number;
    output: number;
    to: number;
    input: number;
    color: string;
    lane?: number;
}

const workflow = computed<Workflow | null>(() => session.value?.workflow ?? null);
const fieldDefinitions = computed(() => {
    const fields = new Map<string, { field: FieldDefinition; nodeName: string }>();
    if (workflow.value) {
        for (const [id, field] of Object.entries(workflow.value.inputs)) {
            fields.set(id, { field, nodeName: 'Workflow inputs' });
        }
        for (const step of workflow.value.steps) {
            for (const [id, field] of Object.entries(step.outputs)) {
                fields.set(id, { field, nodeName: step.name });
            }
        }
    }
    return fields;
});

function outputPorts(fields: Record<string, FieldDefinition>): Port[] {
    return Object.entries(fields).map(([id, field]) => ({ ...field, id, fieldId: id }));
}

function inputPorts(fields: Record<string, FieldReference>): Port[] {
    return Object.entries(fields).map(([id, reference]) => {
        const { field, nodeName } = fieldDefinitions.value.get(reference.referenceId)!;
        return {
            id,
            fieldId: reference.referenceId,
            name: field.name,
            description: field.description,
            source: `${nodeName} → ${field.name}`
        };
    });
}

const diagramNodes = computed<DiagramNode[]>(() => workflow.value ? [
    { id: 'start', name: 'Workflow inputs', type: 'start', inputs: [], outputs: outputPorts(workflow.value.inputs) },
    ...workflow.value.steps.map(step => ({
        id: step.id,
        name: step.name,
        type: step.type,
        inputs: inputPorts(step.inputs),
        outputs: outputPorts(step.outputs)
    })),
    { id: 'finish', name: 'Workflow outputs', type: 'finish', inputs: inputPorts(workflow.value.outputs), outputs: [] }
] : []);

function fieldColor(id: string) {
    let hash = 0;
    for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return colors[hash % colors.length]!;
}

const connections = computed(() => {
    const sources = new Map<string, { from: number; output: number }>();
    diagramNodes.value.forEach((node, from) => {
        node.outputs.forEach((port, output) => sources.set(port.fieldId, { from, output }));
    });
    const result: Connection[] = [];
    let lane = 0;
    diagramNodes.value.forEach((node, to) => {
        node.inputs.forEach((port, input) => {
            const source = sources.get(port.fieldId)!;
            result.push({
                ...source,
                id: port.id,
                fieldId: port.fieldId,
                name: port.name,
                to,
                input,
                color: fieldColor(port.fieldId),
                lane: to - source.from > 1 ? 32 + lane++ * 28 : undefined
            });
        });
    });
    return result;
});

const nodeTop = computed(() => Math.max(40, ...connections.value.map(connection => (connection.lane ?? 0) + 36)));
const nodeHeight = computed(() => 116 + Math.max(1, ...diagramNodes.value.map(node => Math.max(node.inputs.length, node.outputs.length))) * 32);
const diagramWidth = computed(() => diagramNodes.value.length * 300 - 20);
const diagramHeight = computed(() => nodeTop.value + nodeHeight.value + 24);

function portY(index: number) {
    return nodeTop.value + 90 + index * 32;
}

function connectionPath(connection: Connection) {
    const x1 = 20 + connection.from * 300 + 240;
    const x2 = 20 + connection.to * 300;
    const y1 = portY(connection.output);
    const y2 = portY(connection.input);
    if (connection.lane !== undefined) {
        return `M ${x1} ${y1} H ${x1 + 18} Q ${x1 + 28} ${y1} ${x1 + 28} ${y1 - 10} V ${connection.lane + 10} Q ${x1 + 28} ${connection.lane} ${x1 + 38} ${connection.lane} H ${x2 - 38} Q ${x2 - 28} ${connection.lane} ${x2 - 28} ${connection.lane + 10} V ${y2 - 10} Q ${x2 - 28} ${y2} ${x2 - 18} ${y2} H ${x2}`;
    }
    return `M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2} ${y2}`;
}

const modificationText = ref('');
const modifyPending = ref(false);
const modifyError = ref('');
const { data: session, error } = await useFetch(() => `/api/sessions/${route.params.uuid}`);

if (error.value) {
    throw createError({
        statusCode: error.value.statusCode ?? 500,
        statusMessage: error.value.statusCode === 404 ? 'Session not found' : 'Unable to load session',
        fatal: true
    });
}

watch(workflow, () => {
    activeField.value = null;
    selectedStep.value = null;
});

async function modifyWorkflow() {
    if (modifyPending.value) return;

    modifyPending.value = true;
    modifyError.value = '';
    try {
        const result = await $fetch('/api/workflows/modify', {
            method: 'POST',
            body: {
                text: modificationText.value,
                session: { uuid: session.value!.uuid }
            }
        });
        session.value!.workflow = result.workflow;
    } catch {
        modifyError.value = 'Unable to modify workflow. Please try again.';
    } finally {
        modifyPending.value = false;
    }
}
</script>

<template>
    <BasePage>
        <h1>Session</h1>
        <p>Session UUID: {{ session?.uuid }}</p>
        <form class="flex flex-col gap-3 mt-6" @submit.prevent="modifyWorkflow">
            <label for="workflow-modifications">Describe your workflow or requested changes</label>
            <Textarea id="workflow-modifications" v-model="modificationText" :rows="5" auto-resize />
            <Button type="submit" label="Modify workflow" :loading="modifyPending" :disabled="modifyPending" />
            <p v-if="modifyError" role="alert">{{ modifyError }}</p>
        </form>
        <section v-if="workflow" class="workflow-preview" aria-labelledby="workflow-title">
            <header class="workflow-heading">
                <div class="workflow-eyebrow">Workflow <span>Schema {{ workflow._schemaVersion }}</span></div>
                <h2 id="workflow-title">Workflow</h2>
                <p>{{ workflow.description }}</p>
                <p class="flow-hint">Follow the lines from output ports to input ports. Hover or select a field to trace its connection. Scroll horizontally on smaller screens.</p>
            </header>

            <div class="diagram-scroll" tabindex="0" role="region" aria-label="Workflow connections; scroll horizontally to see all steps">
                <div class="workflow-diagram" :style="{ width: `${diagramWidth}px`, height: `${diagramHeight}px` }">
                    <svg class="connection-layer" :width="diagramWidth" :height="diagramHeight" :viewBox="`0 0 ${diagramWidth} ${diagramHeight}`" role="img" aria-label="Field connections between workflow steps">
                        <g v-for="connection in connections" :key="connection.id" :class="{ 'connection-muted': activeField && activeField !== connection.fieldId }">
                            <title>{{ connection.name }}: {{ diagramNodes[connection.from]?.name }} → {{ diagramNodes[connection.to]?.name }}</title>
                            <path :d="connectionPath(connection)" fill="none" :stroke="connection.color" :stroke-width="activeField === connection.fieldId ? 3.5 : 2" />
                            <path :d="`M ${14 + connection.to * 300} ${portY(connection.input) - 4} l 6 4 l -6 4`" fill="none" :stroke="connection.color" stroke-width="2" />
                            <text v-if="connection.lane !== undefined" :x="(260 + connection.from * 300 + 20 + connection.to * 300) / 2" :y="connection.lane - 8" text-anchor="middle" :fill="connection.color">{{ connection.name }}</text>
                        </g>
                    </svg>
                    <article v-for="(node, nodeIndex) in diagramNodes" :key="node.id" class="diagram-node" :style="{ left: `${20 + nodeIndex * 300}px`, top: `${nodeTop}px`, height: `${nodeHeight}px` }">
                        <header class="node-heading">
                            <span class="node-kind">{{ node.type !== 'start' && node.type !== 'finish' ? `Step ${nodeIndex} · ` : '' }}{{ node.type }}</span>
                            <h3 :title="node.name">{{ node.name }}</h3>
                        </header>
                        <div class="port-columns">
                            <section>
                                <h4>{{ node.inputs.length ? 'Inputs' : '' }}</h4>
                                <button v-for="field in node.inputs" :key="field.id" type="button" class="field-port input-port" :class="{ 'port-muted': activeField && activeField !== field.fieldId }" :style="{ '--field-color': fieldColor(field.fieldId) }" :title="field.source ?? field.name" @mouseenter="activeField = field.fieldId" @mouseleave="activeField = null" @focus="activeField = field.fieldId" @blur="activeField = null" @click="activeField = field.fieldId">
                                    <span class="port-dot" aria-hidden="true"></span><span class="port-name">{{ field.name }}</span>
                                </button>
                            </section>
                            <section>
                                <h4>{{ node.outputs.length ? 'Outputs' : '' }}</h4>
                                <button v-for="field in node.outputs" :key="field.id" type="button" class="field-port output-port" :class="{ 'port-muted': activeField && activeField !== field.fieldId }" :style="{ '--field-color': fieldColor(field.fieldId) }" :title="field.description" @mouseenter="activeField = field.fieldId" @mouseleave="activeField = null" @focus="activeField = field.fieldId" @blur="activeField = null" @click="activeField = field.fieldId">
                                    <span class="port-name">{{ field.name }}</span><span class="port-dot" aria-hidden="true"></span>
                                </button>
                            </section>
                        </div>
                        <button v-if="node.type !== 'start' && node.type !== 'finish'" type="button" class="configuration-toggle" :aria-expanded="selectedStep === node.id" @click="selectedStep = selectedStep === node.id ? null : node.id">{{ selectedStep === node.id ? 'Hide' : 'View' }} configuration</button>
                    </article>
                </div>
            </div>
            <template v-for="step in workflow.steps" :key="step.id">
                <section v-if="selectedStep === step.id" class="configuration-panel" :aria-label="`${step.name} configuration`">
                    <h3>{{ step.name }}</h3>
                    <p v-if="step.description">{{ step.description }}</p>
                    <template v-if="step.type === 'api'">
                        <h4>Mock response</h4>
                        <pre>{{ step.config.returnValue }}</pre>
                    </template>
                    <p v-else class="instructions">{{ step.config.instructions }}</p>
                    <ul><li v-for="(field, id) in step.outputs" :key="id"><code>{{ field.name }}</code> · {{ field.type }} — {{ field.description }}<span v-if="'source' in field"> · Response: {{ field.source }}</span><span v-if="'enum' in field && field.enum"> · Values: {{ field.enum.join(', ') }}</span></li></ul>
                </section>
            </template>
        </section>
        <p v-else class="mt-6">No workflow yet. Describe your workflow below to generate one.</p>
    </BasePage>
</template>

<style scoped>
.workflow-preview {
    margin: 24px 0;
    padding: 20px 0 0;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    color: #0f172a;
    min-width: 0;
}
.workflow-heading { padding: 0 20px; }
.workflow-eyebrow { display: flex; gap: 12px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
.workflow-heading h2 { margin: 6px 0; font-size: 22px; font-weight: 700; }
.workflow-heading p { margin: 4px 0; font-size: 13px; color: #475569; }
.workflow-heading .flow-hint { font-size: 11px; color: #64748b; }
.diagram-scroll { overflow-x: auto; padding: 8px 0; }
.diagram-scroll:focus-visible { outline: 2px solid #6366f1; outline-offset: -2px; }
.workflow-diagram { position: relative; }
.connection-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.connection-layer text { font-size: 11px; font-family: monospace; }
.connection-muted { opacity: 0.12; }
.diagram-node {
    position: absolute;
    width: 240px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 2px 4px #0f172a06;
}
.node-heading { height: 63px; padding: 12px; border-bottom: 1px solid #f1f5f9; }
.node-kind { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
.node-heading h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 3px 0 0; font-size: 15px; font-weight: 650; }
.port-columns { display: grid; grid-template-columns: 1fr 1fr; }
.port-columns section { min-width: 0; }
.port-columns h4 { height: 10px; margin: 0; padding: 0 10px; font-size: 8px; color: #94a3b8; text-transform: uppercase; line-height: 10px; }
.port-columns section:has(.output-port) h4 { text-align: right; }
.field-port {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    width: 100%;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: #334155;
    font-family: monospace;
    font-size: 10px;
    cursor: pointer;
    white-space: nowrap;
}
.field-port:hover, .field-port:focus-visible { background: #f1f5f9; outline: 1px solid var(--field-color); outline-offset: -2px; }
.port-name { overflow: hidden; text-overflow: ellipsis; }
.output-port { justify-content: flex-end; }
.port-dot { position: absolute; width: 8px; height: 8px; border: 2px solid var(--field-color); border-radius: 50%; background: #fff; z-index: 3; }
.input-port .port-dot { left: -5px; }
.output-port .port-dot { right: -5px; }
.port-muted { opacity: 0.25; }
.configuration-toggle { position: absolute; bottom: 10px; left: 12px; border: 0; background: transparent; padding: 0; font-size: 10px; color: #64748b; cursor: pointer; }
.configuration-toggle:hover { color: #4338ca; text-decoration: underline; }
.configuration-panel { margin: 0 20px 20px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 12px; overflow-wrap: anywhere; }
.configuration-panel pre, .configuration-panel .instructions { white-space: pre-wrap; overflow-wrap: anywhere; }
.configuration-panel h3 { margin: 0 0 12px; font-weight: 650; }
.configuration-panel dl { margin: 0; display: grid; gap: 6px; }
.configuration-panel dl > div { display: flex; flex-wrap: wrap; gap: 12px; }
.configuration-panel dt { color: #64748b; }
.configuration-panel dd { margin: 0; }
.configuration-panel p { margin: 12px 0; line-height: 1.6; }
.configuration-panel ul { padding-left: 16px; margin: 12px 0 0; }
.configuration-panel li + li { margin-top: 6px; }
</style>
