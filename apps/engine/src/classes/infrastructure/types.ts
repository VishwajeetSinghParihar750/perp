type ReplyAddress =
  | {
      redisQueueId: string;
    }
  | {
      redisStreamId: string;
    };

function getReplyAddressKey(address: ReplyAddress): string {
  if ("redisQueueId" in address) {
    return `queue:${address.redisQueueId}`;
  }
  return `stream:${address.redisStreamId}`;
}

function replyAddressesEqual(a: ReplyAddress, b: ReplyAddress): boolean {
  return getReplyAddressKey(a) === getReplyAddressKey(b);
}

export type { ReplyAddress };
export { getReplyAddressKey, replyAddressesEqual };
