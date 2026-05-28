import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

export type WebSocketMessageHandler = (message: string) => void;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function isWebSocketUpgrade(request: IncomingMessage): boolean {
	return request.headers.upgrade?.toLowerCase() === "websocket";
}

export function acceptWebSocket(request: IncomingMessage, socket: Socket): WebSocketConnection {
	const key = request.headers["sec-websocket-key"];
	if (typeof key !== "string") {
		socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
		throw new Error("Missing Sec-WebSocket-Key header");
	}

	const accept = createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
	socket.write(
		[
			"HTTP/1.1 101 Switching Protocols",
			"Upgrade: websocket",
			"Connection: Upgrade",
			`Sec-WebSocket-Accept: ${accept}`,
			"",
			"",
		].join("\r\n"),
	);
	return new WebSocketConnection(socket);
}

export class WebSocketConnection {
	private socket: Socket;
	private buffer = Buffer.alloc(0);
	private messageListeners = new Set<WebSocketMessageHandler>();
	private closeListeners = new Set<() => void>();
	private isClosed = false;

	constructor(socket: Socket) {
		this.socket = socket;
		socket.on("data", (chunk) => this.handleData(chunk));
		socket.once("close", () => this.handleClose());
		socket.once("error", () => this.handleClose());
	}

	onMessage(listener: WebSocketMessageHandler): () => void {
		this.messageListeners.add(listener);
		return () => this.messageListeners.delete(listener);
	}

	onClose(listener: () => void): () => void {
		this.closeListeners.add(listener);
		return () => this.closeListeners.delete(listener);
	}

	sendJson(value: unknown): void {
		this.sendText(JSON.stringify(value));
	}

	sendText(text: string): void {
		if (this.isClosed) {
			return;
		}
		this.socket.write(encodeFrame(0x1, Buffer.from(text, "utf8")));
	}

	close(): void {
		if (this.isClosed) {
			return;
		}
		this.socket.write(encodeFrame(0x8, Buffer.alloc(0)));
		this.socket.end();
		this.handleClose();
	}

	private handleData(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (true) {
			const frame = decodeFrame(this.buffer);
			if (!frame) {
				return;
			}
			this.buffer = this.buffer.subarray(frame.bytesConsumed);
			if (frame.opcode === 0x8) {
				this.close();
				return;
			}
			if (frame.opcode === 0x9) {
				this.socket.write(encodeFrame(0xa, frame.payload));
				continue;
			}
			if (frame.opcode !== 0x1) {
				continue;
			}
			const text = frame.payload.toString("utf8");
			for (const listener of this.messageListeners) {
				listener(text);
			}
		}
	}

	private handleClose(): void {
		if (this.isClosed) {
			return;
		}
		this.isClosed = true;
		for (const listener of this.closeListeners) {
			listener();
		}
		this.messageListeners.clear();
		this.closeListeners.clear();
	}
}

interface DecodedFrame {
	opcode: number;
	payload: Buffer;
	bytesConsumed: number;
}

function decodeFrame(buffer: Buffer): DecodedFrame | undefined {
	if (buffer.length < 2) {
		return undefined;
	}

	const first = buffer[0];
	const second = buffer[1];
	const opcode = first & 0x0f;
	const masked = (second & 0x80) !== 0;
	let payloadLength = second & 0x7f;
	let offset = 2;

	if (payloadLength === 126) {
		if (buffer.length < offset + 2) {
			return undefined;
		}
		payloadLength = buffer.readUInt16BE(offset);
		offset += 2;
	} else if (payloadLength === 127) {
		if (buffer.length < offset + 8) {
			return undefined;
		}
		const longLength = buffer.readBigUInt64BE(offset);
		if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
			throw new Error("WebSocket frame is too large");
		}
		payloadLength = Number(longLength);
		offset += 8;
	}

	let mask: Buffer | undefined;
	if (masked) {
		if (buffer.length < offset + 4) {
			return undefined;
		}
		mask = buffer.subarray(offset, offset + 4);
		offset += 4;
	}

	if (buffer.length < offset + payloadLength) {
		return undefined;
	}

	const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
	if (mask) {
		for (let i = 0; i < payload.length; i++) {
			payload[i] ^= mask[i % 4];
		}
	}

	return {
		opcode,
		payload,
		bytesConsumed: offset + payloadLength,
	};
}

function encodeFrame(opcode: number, payload: Buffer): Buffer {
	const payloadLength = payload.length;
	let header: Buffer;
	if (payloadLength < 126) {
		header = Buffer.from([0x80 | opcode, payloadLength]);
	} else if (payloadLength <= 0xffff) {
		header = Buffer.alloc(4);
		header[0] = 0x80 | opcode;
		header[1] = 126;
		header.writeUInt16BE(payloadLength, 2);
	} else {
		header = Buffer.alloc(10);
		header[0] = 0x80 | opcode;
		header[1] = 127;
		header.writeBigUInt64BE(BigInt(payloadLength), 2);
	}
	return Buffer.concat([header, payload]);
}
