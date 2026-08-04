# Maestro Hub

MusicCRM – MVP (Versão 1)

Você é um arquiteto de software sênior e especialista em UX/UI. Desenvolva um sistema web moderno, responsivo e escalável para gestão de professores particulares de música.

O objetivo desta primeira versão não é criar um sistema completo, mas construir uma base sólida, organizada e preparada para futuras expansões.

Objetivo principal

Resolver o maior problema do professor: organizar alunos, agenda e materiais em um único lugar, substituindo calendários e anotações espalhadas.

A arquitetura deve ser preparada para futuras funcionalidades como financeiro, contratos, IA, portal do aluno e automações, porém essas funcionalidades não devem ser implementadas nesta versão.



Design

Criar uma interface inspirada em Notion, Linear e Google Calendar.

Características:

limpa

minimalista

rápida

moderna

profissional

responsiva

modo claro e escuro

animações suaves

excelente experiência em desktop e celular



Menu lateral

Apenas estas páginas:

Dashboard

Agenda

Alunos

Biblioteca

Configurações

Não criar outros menus nesta versão.



Dashboard

Ao entrar no sistema o professor deve visualizar:

Aulas de hoje

Próxima aula

Quantidade de alunos ativos

Horas de aula da semana

Próximos compromissos

Botão “Nova Aula”

O dashboard deve ser simples e objetivo.



Cadastro de alunos

Cada aluno deve possuir:

Dados

Foto

Nome

WhatsApp

E-mail (opcional)

Instrumento

Objetivo

Observações

Informações da aula

Dia da semana

Horário habitual

Duração padrão

Tipo da aula

Local

Criar busca por nome e filtros simples.



Perfil do aluno

Ao clicar em um aluno abrir uma página exclusiva contendo:

Dados pessoais

Todas as informações cadastradas.

Próximas aulas

Lista das aulas futuras.

Histórico

Lista cronológica das aulas realizadas.

Materiais

Arquivos vinculados ao aluno.

Observações

Anotações livres do professor.

Toda a informação do aluno deve estar concentrada nesta página.



Agenda

Esta será a principal funcionalidade.

Criar uma agenda semelhante ao Google Calendar.

Visualizações:

Dia

Semana

Mês

Ao criar uma aula permitir selecionar:

aluno

data

horário

duração

tipo da aula

local

observações

Permitir:

editar

remarcar

cancelar

duplicar

O sistema deve impedir conflitos de horário.



Disponibilidade

Nas configurações o professor poderá informar:

dias disponíveis

horários disponíveis

férias

dias bloqueados

A agenda somente permitirá novos agendamentos dentro desses horários.



Biblioteca

Criar um gerenciador simples de arquivos.

Permitir upload de:

PDF

Imagens

Vídeos

Áudios

Cada arquivo poderá ser:

geral

vinculado a um aluno específico

Exibir os arquivos em formato de lista com pesquisa.



Relatório da aula

Ao finalizar uma aula abrir automaticamente um pequeno formulário contendo:

Conteúdo estudado

Exercícios passados

Observações

Essas informações devem ser salvas automaticamente no histórico do aluno.



Pesquisa

Criar pesquisa global para localizar rapidamente:

alunos

aulas

materiais



Configurações

Nesta primeira versão apenas:

Perfil do professor

Foto

Nome

WhatsApp

Tema claro/escuro

Dias disponíveis

Horários disponíveis



Banco de dados

Estruturar desde o início para permitir futuras tabelas de:

financeiro

contratos

formulários

IA

portal do aluno

notificações

mensagens

pagamentos

evolução

cronogramas

Mesmo que essas funcionalidades ainda não sejam implementadas.



Requisitos técnicos

Código limpo e modular.

Componentes reutilizáveis.

Banco de dados normalizado.

Responsividade completa.

Navegação rápida.

Interface intuitiva.

Arquitetura preparada para crescimento.



Importante

Não implemente funcionalidades extras nesta primeira versão.

Priorize estabilidade, organização, velocidade e excelente experiência do usuário.

O resultado deve ser um MVP sólido, elegante e pronto para receber novas funcionalidades sem necessidade de reestruturação.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ae5e4419-df96-482c-898d-5ebaf1e88079).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
