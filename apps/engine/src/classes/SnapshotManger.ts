import { readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";

interface Snapshotable<T> {
  getSnapshot(): T;
  loadSnapshot(snapshot: T): void;
}

class SnapshotManager {
  private lastRedisStreamMessageId: string = "0";
  private lastFullyProcessedRedisStreamMessageId: string = "0";
  private snapshotableClass: Snapshotable<any>;
  private snapshotCounter: number = 0;

  // return redis messge id at the time of snpahsot
  initialize(): string {
    let toReturn = this.loadSnapshot();
    return toReturn;
  }
  constructor(snapshotableClass: Snapshotable<any>) {
    this.snapshotableClass = snapshotableClass;
  }

  onFullMessageProcessed(messageId: string) {
    if (this.lastFullyProcessedRedisStreamMessageId < messageId)
      this.lastFullyProcessedRedisStreamMessageId = messageId;
  }

  private loadSnapshot(): string {
    // get max number redis messgae id snapshot

    let lastRedisMessageId = "0";

    let files = readdirSync(path.join(process.cwd(), "/data/snapshots"));

    let lastProcessed: string | undefined = undefined;

    while (files.length) {
      try {
        let fileName = files.pop();

        // load snapshot from this file
        let fileData = readFileSync(
          path.join(process.cwd(), `data/snapshots/${fileName}`),
          "utf-8",
        );

        let {
          snapshot,
          lastFullyProcessedRedisStreamMessageId,
          lastRedisMessageId,
        } = JSON.parse(fileData);

        if (!lastProcessed) {
          lastProcessed = lastFullyProcessedRedisStreamMessageId;
        }

        if (lastRedisMessageId <= lastProcessed!) {
          this.snapshotableClass.loadSnapshot(snapshot);
          lastRedisMessageId = lastRedisMessageId;
          break;
        }

        // maybe throw when unable to load snapshot so, we can replay from 0 in event stream
        // TODO : if this fails we should restart the engine server,, coz some might have got the state loaded ,and others failed
      } catch (error) {
        // start from 0
        lastRedisMessageId = "0";
        break;
      }
    }

    // console.log(JSON.stringify(snapshotableClass.getSnapshot(), null, 2));

    return lastRedisMessageId;
  }

  onMessageProcessed = (messageId: string) => {
    if (messageId <= this.lastFullyProcessedRedisStreamMessageId) return; // this will happen during replay

    this.snapshotCounter++;

    // save every 100 fully processes redis messages
    if (this.snapshotCounter == 5) {
      this.snapshotCounter = 0;
      // make snapshot

      let snapshotObject = {
        snapshot: this.snapshotableClass.getSnapshot(),
        lastRedisStreamMessageId: this.lastRedisStreamMessageId,
        lastFullyProcessedRedisStreamMessageId:
          this.lastFullyProcessedRedisStreamMessageId,
      };

      let toSaveSnapshot = JSON.stringify(snapshotObject, null, 2);
      console.log("saving engine snapshot ", toSaveSnapshot);
      try {
        writeFileSync(
          path.join(
            process.cwd(),
            `data/snapshots/${this.lastRedisStreamMessageId}.json`,
          ),
          toSaveSnapshot,
        );
      } catch (error) {
        console.log(
          "saving snapshot to disk failed at redis message position ",
          this.lastRedisStreamMessageId,
        );
      }

      // save this to disk
    }
  };
}

export default SnapshotManager;
export type { Snapshotable };
