import { parse, tokenize, visit } from "@solidity-parser/parser";
import {
  ASTNode,
  ContractDefinition,
  FunctionDefinition,
  ModifierDefinition,
} from "@solidity-parser/parser/dist/src/ast-types";
import config from "../config";
import { AntlrToken, Token } from "@solidity-parser/parser/dist/src/types";
/**
 * Represents a CodeInspector class that analyzes code and provides information about contracts, modifiers, functions, and links.
 */
export default class CodeInspector {
  private nodes: ASTNode[];
  private raw: any;

  /**
   * Constructs a new instance of the CodeInspector class.
   * @param input The code to be inspected.
   */
  constructor(input: string) {
    const data = parse(input, { loc: true, range: false, tolerant: true, tokens: true });
    this.nodes = data.children;
    this.raw = data;
  }

  /**
   * Gets all contract definitions in the code.
   * @returns An array of ContractDefinition objects.
   */
  public getContracts() {
    return this.nodes.filter((x) => x.type == "ContractDefinition") as ContractDefinition[];
  }

  /**
   * Gets a specific contract by its name.
   * @param name The name of the contract.
   * @returns The ContractDefinition object with the specified name, or undefined if not found.
   */
  public getContract(name: string) {
    return this.getContracts().find((x) => x.name == name);
  }

  /**
   * Gets all modifier definitions in the code.
   * @returns An array of ModifierDefinition objects.
   */
  public getModifiers() {
    const modifiers: ModifierDefinition[] = [];
    visit(this.raw, {
      ModifierDefinition: (node) => {
        modifiers.push(node);
      },
    });
    return modifiers;
  }

  /**
   * Gets all function definitions in the code.
   * @returns An array of FunctionDefinition objects.
   */
  public getFunctions() {
    const functions: FunctionDefinition[] = [];
    visit(this.raw, {
      FunctionDefinition: (node) => {
        functions.push(node);
      },
    });
    return functions;
  }

  /**
   * Extracts links from the code.
   * @returns An array of extracted links.
   */
  public extractLinks() {
    const links = [];
    this.raw.tokens.map((x: Token) => {
      const global = new RegExp(`(https?:\\/\\/)?(?:www\\.)?(t\\.me|twitter\\.com)\\/[a-zA-Z0-9_\\-]+`, "g");
      const discord = new RegExp("https://discord\\.com/invite/[a-zA-Z0-9]+", "g");
      const matches = [x.value.match(discord), x.value.match(global)].filter((x) => x != null);
      if (matches) {
        matches.forEach((match) => {
          links.push(...match);
        });
      }
    });
    return links;
  }

  /**
   * Finds unknown modifiers in the code.
   * @param modifiers An array of ModifierDefinition objects.
   * @returns An array of unknown modifiers with additional information.
   */
  public unknownModifiers(modifiers: ModifierDefinition[]) {
    const unknowns = modifiers.filter((x) => !config.knownModifiers.find((y) => y == x.name));

    return unknowns.map((x) => {
      let hiddenOwner = false;

      visit(x, {
        FunctionCall: (node) => {
          if (node.names.includes("msgSender")) {
            hiddenOwner = true;
          }
          visit(node, {
            Identifier: (idf) => {
              if (idf.name.includes("msgSender")) {
                hiddenOwner = true;
              }
            },
          });
        },
        MemberAccess: (node) => {
          if (node.memberName == "sender") {
            hiddenOwner = true;
          }
        },
      });
      return { ...x, hiddenOwner };
    });
  }
}
