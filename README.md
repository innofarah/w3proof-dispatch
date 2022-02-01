# Description

This tool (w3proof-dispatch) is a starter exploratory tool/project for the [W3Proof](https://www.inria.fr/en/w3proof) 'Exploratory Action' proposed and initiated by [Dale Miller](http://www.lix.polytechnique.fr/Labo/Dale.Miller/). An 'Exploratory Action' is a term coined by [Inria](https://www.inria.fr/en) to refer to projects attempting to explore new research themes relative to Inria's usually addressed themes in computer science and which might extend to other areas of knowledge.

At the higher level, this project attempts to address the notion of providing trust on the web by exploiting [formal proofs](https://en.wikipedia.org/wiki/Formal_verification#:~:text=In%20the%20context%20of%20hardware,using%20formal%20methods%20of%20mathematics.), in contrast to the usual scene where trust in a 'statement' is provided only through trusting the entity claiming that statement, usually by the [public key infrastructure](https://en.wikipedia.org/wiki/Public_key_infrastructure) model or by the [web of trust](https://en.wikipedia.org/wiki/Web_of_trust) model. Trust here could refer to many themes, including for example trust in software components, providing scientific reproducibility and eventually trusting produced scientific results, and trust within journalism and news platforms. 'Trust on the web' within the context of these themes means that the 'data to be trusted', whatever that might be, is exchanged through the web, and thus the notion of trust needs to be addressed within the structure of the web.
Naturally, before thinking about how to achieve this wide-range goal itself, the needed tools to achieve it need to be investigated thoroughly. As formal proofs are the driving force and the essence of what the source of trust is desired to be, the usage of formal proofs within the realm of the web needs to be addressed.

Basically, we can consider formal proofs to be some 'artifacts' that are considered evidence that assert the validity of some statement. These 'artifacts' are usually produced by [theorem provers](https://en.wikipedia.org/wiki/Automated_theorem_proving) and [proof assistants](https://en.wikipedia.org/wiki/Proof_assistant#:~:text=In%20computer%20science%20and%20mathematical,proofs%20by%20human%2Dmachine%20collaboration.). To trust a statement 'on the web' means to 'declare' this trust and transmit the 'declaration' through the web. As we are considering formal proofs to be the source of trust, what needs to be transmitted and exchanged as the embodiement of this trust are the formal proofs themselves, and thus the 'artifacts' referring to them.

---
The components considered are the Abella proof assistant, and the IPFS/IPLD model.  

```javascript
{ "some": "json" }
```
