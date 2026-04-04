import type {
  RemoteChannelId,
  RemoteEditMessageRequest,
  RemoteInboundMessage,
  RemoteSendMessageRequest,
  RemoteSendMessageResponse,
} from '@/types/remote-control';

export interface RemoteChannelAdapter {
  readonly channelId: RemoteChannelId;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onInbound: (handler: (message: RemoteInboundMessage) => void) => () => void;
  sendMessage: (request: RemoteSendMessageRequest) => Promise<RemoteSendMessageResponse>;
  editMessage: (request: RemoteEditMessageRequest) => Promise<void>;
}
