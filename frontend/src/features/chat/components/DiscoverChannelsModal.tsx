import type { FormEvent } from "react";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Modal } from "../../../components/Modal";
import type { Channel } from "../../../types/chat";
import "./DiscoverChannelsModal.css";

interface DiscoverChannelsModalProps {
  actionError: string | null;
  actionLoading: boolean;
  channelDescription: string;
  channelName: string;
  channels: Channel[];
  onChannelDescriptionChange: (value: string) => void;
  onChannelNameChange: (value: string) => void;
  onClose: () => void;
  onCreateChannel: (event: FormEvent<HTMLFormElement>) => void;
  onJoinChannel: (channel: Channel) => void;
  open: boolean;
}

export function DiscoverChannelsModal({
  actionError,
  actionLoading,
  channelDescription,
  channelName,
  channels,
  onChannelDescriptionChange,
  onChannelNameChange,
  onClose,
  onCreateChannel,
  onJoinChannel,
  open
}: DiscoverChannelsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="发现频道">
      <form className="discover-create" onSubmit={onCreateChannel}>
        <input
          data-testid="channel-name-input"
          onChange={(event) => onChannelNameChange(event.target.value)}
          placeholder="新频道名称"
          value={channelName}
        />
        <input
          data-testid="channel-description-input"
          onChange={(event) => onChannelDescriptionChange(event.target.value)}
          placeholder="频道说明"
          value={channelDescription}
        />
        <Button disabled={actionLoading || !channelName.trim()} type="submit">
          创建
        </Button>
      </form>
      {actionError ? <div className="message-error">{actionError}</div> : null}
      <section className="discover-list">
        {channels.length ? (
          channels.map((channel) => (
            <article className="discover-channel" key={channel.id}>
              <div>
                <strong># {channel.name}</strong>
                <p>{channel.description}</p>
              </div>
              <Button
                data-testid={`join-channel-${channel.name}`}
                disabled={actionLoading}
                onClick={() => onJoinChannel(channel)}
                type="button"
              >
                加入
              </Button>
            </article>
          ))
        ) : (
          <EmptyState text="暂无可加入频道" />
        )}
      </section>
    </Modal>
  );
}
