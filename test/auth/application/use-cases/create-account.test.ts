import { createAccount } from "@/auth/application/use-cases/create-account.js"
import type { User } from "@/auth/domain/entities/account.entity.js"
import { EmailAlreadyTakenError } from "@/auth/domain/exceptions/email-already-taken.error.js"
import { InvalidPasswordError } from "@/auth/domain/exceptions/invalid-password.error.js"
import { PasswordMismatchError } from "@/auth/domain/exceptions/password-mismatch.error.js"
import { AccountRepository } from "@/auth/domain/repositories/account.repository.js"
import { PasswordService } from "@/auth/domain/services/password.service.js"
import { createEmail } from "@/auth/domain/value-objects/Email.js"
import { IdGenerator } from "@/shared/domain/services/id-generator.service.js"
import { describe, expect, test } from "@effect/vitest"
import { createMockAccountRepository } from "@test/auth/domain/repositories/account.repository.mock.js"
import { createMockPasswordService } from "@test/auth/domain/services/password.service.mock.js"
import { createMockIdGenerator } from "@test/shared/domain/services/id-generator.service.mock.js"
import { Effect, Layer, pipe } from "effect"

const validPassword = "password"
const anotherValidPassword = "another-password"
const invalidPassword = "invalid-password"
const hashedPassword = "hashed-password"
const id = "id"
const email = Effect.runSync(createEmail("test@test.com"))

const dependencies = (
  { initialAccounts, isPasswordValid }: { isPasswordValid: boolean; initialAccounts?: Array<User> }
) =>
  Layer.mergeAll(
    Layer.effect(PasswordService, createMockPasswordService(isPasswordValid, hashedPassword)),
    Layer.effect(AccountRepository, createMockAccountRepository(initialAccounts ?? [])),
    Layer.effect(IdGenerator, createMockIdGenerator(id))
  )

describe("CreateAccount", () => {
  test("should return an account when it is created", () =>
    pipe(
      Effect.gen(function*() {
        const request = {
          email,
          password: validPassword,
          confirmPassword: validPassword
        }

        const result = yield* createAccount(request)

        expect(result).toStrictEqual({ id, email, password: hashedPassword })
      }),
      Effect.provide(dependencies({ isPasswordValid: true })),
      Effect.runPromise
    ))

  test("should save the account in the repository", () =>
    pipe(
      Effect.gen(function*() {
        const request = {
          email,
          password: validPassword,
          confirmPassword: validPassword
        }

        yield* createAccount(request)

        const accountRepository = yield* AccountRepository
        const accounts = yield* accountRepository.getAll()

        expect(accounts).toHaveLength(1)
        expect(accounts[0]).toStrictEqual({ id, email, password: hashedPassword })
      }),
      Effect.provide(dependencies({ isPasswordValid: true })),
      Effect.runPromise
    ))

  test("should not create an account if passwords do not match", () =>
    pipe(
      Effect.gen(function*() {
        const request = {
          email,
          password: validPassword,
          confirmPassword: anotherValidPassword
        }

        const error = yield* createAccount(request).pipe(Effect.flip)

        expect(error).toBeInstanceOf(PasswordMismatchError)
      }),
      Effect.provide(dependencies({ isPasswordValid: true })),
      Effect.runPromise
    ))

  test("should not create an account if password is not valid", () =>
    pipe(
      Effect.gen(function*() {
        const request = {
          email,
          password: invalidPassword,
          confirmPassword: invalidPassword
        }

        const error = yield* createAccount(request).pipe(Effect.flip)

        expect(error).toBeInstanceOf(InvalidPasswordError)
      }),
      Effect.provide(dependencies({ isPasswordValid: false })),
      Effect.runPromise
    ))

  test("should not create an account if email is already taken", () =>
    pipe(
      Effect.gen(function*() {
        const request = {
          email,
          password: validPassword,
          confirmPassword: validPassword
        }

        const error = yield* createAccount(request).pipe(Effect.flip)

        expect(error).toBeInstanceOf(EmailAlreadyTakenError)
      }),
      Effect.provide(
        dependencies({ isPasswordValid: true, initialAccounts: [{ id, email, password: hashedPassword }] })
      ),
      Effect.runPromise
    ))
})
